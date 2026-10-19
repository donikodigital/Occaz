// backend/src/wallets/payout-guardrails.service.ts
// [19/10/2026] v1 — Garde-fous d'une demande de retrait conducteur, regroupés dans un fichier à part :
//  1. le montant : entier strictement positif, au moins « payout.min_amount » (jamais zéro) ;
//  2. le plafond sur 24 h glissantes : « payout.daily_max_amount » (0 = aucune limite) ;
//  3. le numéro de destination : un vrai numéro (8 à 15 chiffres, « + » facultatif), plus un texte libre ;
//  4. la confiance dans la destination : le numéro du compte du conducteur et tout numéro déjà payé avec succès sont « connus » ;
//     un NOUVEAU numéro n'est jamais envoyé automatiquement — l'équipe le valide d'abord. Un pirate qui aurait volé le PIN ne peut
//     donc pas vider le portefeuille vers son propre numéro sans qu'un humain regarde.
// Les deux réglages se changent dans l'admin (page « Paramètres »), sans redéploiement.
import { BadRequestException, Injectable } from '@nestjs/common';
import { PayoutStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { formatMoneyWithCurrency, toPositiveMoneyBigInt } from '../common/utils/money.util';

export const PAYOUT_MIN_AMOUNT_KEY = 'payout.min_amount';
export const PAYOUT_DAILY_MAX_KEY = 'payout.daily_max_amount';
export const MANUAL_REASON_NEW_DESTINATION = 'NOUVELLE_DESTINATION';

export interface PayoutRequestCheck {
  amount: bigint;
  /** Numéro nettoyé (espaces, tirets retirés), ou null si le conducteur n'en a pas donné. */
  destinationRef: string | null;
  /** Non nul = ce retrait ne part pas automatiquement : l'équipe doit le valider (raison tracée dans le journal d'audit). */
  manualReason: string | null;
}

/** Retire espaces, points, tirets et parenthèses ; refuse ce qui n'est pas un numéro de téléphone. */
export function normalizeDestination(raw: string | null | undefined): string | null {
  const cleaned = (raw ?? '').replace(/[\s.\-()]/g, '');
  if (!cleaned) return null;
  if (!/^\+?\d{8,15}$/.test(cleaned)) {
    throw new BadRequestException('Numéro Mobile Money invalide : saisis ton numéro avec l\'indicatif du pays (par exemple +224620000000).');
  }
  return cleaned;
}

const digitsOf = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

@Injectable()
export class PayoutGuardrailsService {
  constructor(private readonly prisma: PrismaService) {}

  async check(params: {
    walletId: string;
    driverId: string;
    currencyIsoCode: string;
    rawAmount: string;
    rawDestination?: string | null;
  }): Promise<PayoutRequestCheck> {
    const amount = toPositiveMoneyBigInt(params.rawAmount);
    const destinationRef = normalizeDestination(params.rawDestination);
    const { minAmount, dailyMax } = await this.readLimits();

    if (amount < minAmount) {
      throw new BadRequestException(`Le montant minimum d'un retrait est de ${formatMoneyWithCurrency(minAmount, params.currencyIsoCode)}.`);
    }
    if (dailyMax > 0n) await this.assertUnderDailyCap(params.walletId, amount, dailyMax, params.currencyIsoCode);

    const manualReason = destinationRef && !(await this.isKnownDestination(params.walletId, params.driverId, destinationRef))
      ? MANUAL_REASON_NEW_DESTINATION
      : null;
    return { amount, destinationRef, manualReason };
  }

  private async readLimits(): Promise<{ minAmount: bigint; dailyMax: bigint }> {
    const rows = await this.prisma.platformSetting.findMany({ where: { key: { in: [PAYOUT_MIN_AMOUNT_KEY, PAYOUT_DAILY_MAX_KEY] } } });
    const read = (key: string, fallback: bigint): bigint => {
      const value = rows.find((row) => row.key === key)?.value;
      return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? BigInt(Math.floor(value)) : fallback;
    };
    const minAmount = read(PAYOUT_MIN_AMOUNT_KEY, 1n);
    return { minAmount: minAmount < 1n ? 1n : minAmount, dailyMax: read(PAYOUT_DAILY_MAX_KEY, 0n) };
  }

  private async assertUnderDailyCap(walletId: string, amount: bigint, dailyMax: bigint, isoCode: string): Promise<void> {
    const since = new Date(Date.now() - 24 * 3_600_000);
    const recent = await this.prisma.payout.aggregate({
      where: { walletId, requestedAt: { gte: since }, status: { notIn: [PayoutStatus.FAILED, PayoutStatus.CANCELLED] } },
      _sum: { amount: true },
    });
    const used = recent._sum.amount ?? 0n;
    if (used + amount > dailyMax) {
      const left = dailyMax > used ? dailyMax - used : 0n;
      throw new BadRequestException(
        `Plafond de retrait atteint : ${formatMoneyWithCurrency(dailyMax, isoCode)} par 24 heures. Il te reste ${formatMoneyWithCurrency(left, isoCode)} à retirer aujourd'hui.`,
      );
    }
  }

  /** Numéro du compte ou numéro déjà payé avec succès à ce conducteur. */
  private async isKnownDestination(walletId: string, driverId: string, destination: string): Promise<boolean> {
    const digits = digitsOf(destination);
    const profile = await this.prisma.driverProfile.findUnique({ where: { id: driverId }, select: { user: { select: { phone: true } } } });
    if (digitsOf(profile?.user?.phone) === digits) return true;

    const paid = await this.prisma.payout.findFirst({
      where: { walletId, status: PayoutStatus.PAID, destinationRef: { in: [destination, digits, `+${digits}`] } },
      select: { id: true },
    });
    return Boolean(paid);
  }
}
