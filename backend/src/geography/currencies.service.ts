// backend/src/geography/currencies.service.ts
//
// [23/10/2026] v2 — Suppression d'une devise : un pays « supprimé » n'est que désactivé (il garde sa devise par défaut), ce qui
// bloquait la suppression à cause d'un pays que l'administrateur ne voyait plus. Désormais seuls les pays ACTIFS bloquent ; les
// pays désactivés sont détachés de la devise (dans la même transaction que la suppression). Et si la devise est encore utilisée
// par des trajets, paiements, tarifs…, l'API répond par un message clair (409) au lieu d'une erreur 500.
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

/** Tables qui référencent une devise (nom de table SQL → libellé lisible), pour expliquer pourquoi la suppression est refusée. */
const TABLE_LABELS: Record<string, string> = {
  trips: 'des trajets',
  bookings: 'des réservations',
  shipments: 'des envois',
  payments: 'des paiements',
  payment_transactions: 'des transactions de paiement',
  wallets: 'des portefeuilles',
  wallet_transactions: 'des mouvements de portefeuille',
  platform_withdrawals: 'des retraits de la plateforme',
  payouts: 'des versements',
  commission_rules: 'des règles de commission',
  cancellation_policies: "des frais d'annulation",
  dispute_resolutions: 'des résolutions de litige',
  shipment_categories: "des catégories d'envoi",
  promo_codes: 'des codes promo',
  referrals: 'des parrainages',
};

@Injectable()
export class CurrenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findAll() {
    return this.prisma.currency.findMany({ orderBy: { isoCode: 'asc' } });
  }

  async findOne(id: string) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException('Devise introuvable.');
    return currency;
  }

  async create(dto: CreateCurrencyDto, actorId: string) {
    const currency = await this.prisma.currency.create({
      data: {
        isoCode: dto.isoCode.toUpperCase(),
        name: dto.name,
        symbol: dto.symbol,
        decimalDigits: dto.decimalDigits ?? 0,
      },
    });
    await this.audit.log({ actorId, entityType: 'Currency', entityId: currency.id, action: 'CREATE', diff: { ...dto } });
    return currency;
  }

  async update(id: string, dto: UpdateCurrencyDto, actorId: string) {
    await this.findOne(id);
    const currency = await this.prisma.currency.update({
      where: { id },
      data: { ...dto, isoCode: dto.isoCode ? dto.isoCode.toUpperCase() : undefined },
    });
    await this.audit.log({ actorId, entityType: 'Currency', entityId: id, action: 'UPDATE', diff: { ...dto } });
    return currency;
  }

  /**
   * Bloquée tant qu'un pays ACTIF utilise cette devise par défaut. Les pays désactivés (les pays « supprimés » ne le sont jamais
   * physiquement) sont détachés de la devise avant sa suppression ; tout est annulé si la suppression échoue.
   * Refusée aussi, avec un message clair, si la devise est déjà utilisée par des données (trajets, paiements, tarifs…).
   */
  async remove(id: string, actorId: string) {
    await this.findOne(id);
    const activeCountry = await this.prisma.country.findFirst({ where: { defaultCurrencyId: id, isActive: true } });
    if (activeCountry) {
      throw new ConflictException(
        `Cette devise est utilisée par défaut par "${activeCountry.name}" — change sa devise par défaut avant de la supprimer.`,
      );
    }

    let detachedCountries = 0;
    try {
      await this.prisma.$transaction(async (tx) => {
        const detached = await tx.country.updateMany({
          where: { defaultCurrencyId: id, isActive: false },
          data: { defaultCurrencyId: null },
        });
        detachedCountries = detached.count;
        await tx.currency.delete({ where: { id } });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(this.inUseMessage(error));
      }
      throw error;
    }

    await this.audit.log({
      actorId,
      entityType: 'Currency',
      entityId: id,
      action: 'DELETE',
      ...(detachedCountries > 0 ? { diff: { detachedInactiveCountries: detachedCountries } } : {}),
    });
  }

  /** Message pour une devise encore référencée : on retrouve la table concernée dans l'erreur de clé étrangère. */
  private inUseMessage(error: Prisma.PrismaClientKnownRequestError): string {
    const field = String(error.meta?.field_name ?? error.meta?.constraint ?? '');
    const table = Object.keys(TABLE_LABELS).find((name) => field.startsWith(`${name}_`));
    const what = table ? TABLE_LABELS[table] : 'des données existantes (trajets, paiements, tarifs…)';
    return `Cette devise est encore utilisée par ${what} — elle ne peut pas être supprimée sans casser l'historique.`;
  }
}