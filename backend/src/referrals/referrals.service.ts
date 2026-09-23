// backend/src/referrals/referrals.service.ts
// [23/09/2026] v2 — handleFirstPaymentConfirmed() : complète automatiquement un parrainage à la première prestation confirmée du filleul.
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, ReferralStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { WalletsService } from '../wallets/wallets.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';

/**
 * Parrainage (« Parrainez des amis »). Le code est généré à la demande —
 * jamais à l'inscription, pour ne pas imposer ce coût à chaque compte
 * créé (voir schema.prisma, User.referralCode).
 *
 * La récompense est créditée automatiquement à la première prestation
 * CONFIRMÉE (payée) du filleul — voir handleFirstPaymentConfirmed(),
 * appelée par PaymentsService juste après qu'un paiement de réservation
 * ou d'envoi a été capturé. `complete()` (réservé à l'admin) reste
 * disponible pour les cas particuliers (validation manuelle, montant
 * différent du réglage par défaut) et ne fait rien si le parrainage a
 * déjà été complété automatiquement entre-temps.
 */
@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly wallets: WalletsService,
  ) {}

  /**
   * Appelée par PaymentsService juste après avoir confirmé le paiement
   * d'une réservation ou d'un envoi — jamais depuis une route publique
   * (même règle d'or que confirmPayment). Ne fait rien si :
   * - le filleul n'a pas de parrainage en attente (déjà complété, expiré,
   *   ou jamais parrainé) ;
   * - ce n'est pas sa toute première prestation confirmée (compte les
   *   réservations/envois déjà sortis de leur statut initial pour CE
   *   client — la prestation qui vient de déclencher cet appel a déjà été
   *   confirmée par l'appelant, elle est donc déjà comptée ici).
   *
   * Ne lève jamais d'erreur : un souci de parrainage ne doit jamais faire
   * échouer une confirmation de paiement (l'appelant doit envelopper cet
   * appel dans un try/catch, voir PaymentsService.handleCaptured).
   */
  async handleFirstPaymentConfirmed(customerUserId: string): Promise<void> {
    const referral = await this.prisma.referral.findUnique({
      where: { refereeId: customerUserId },
      include: { referrer: { include: { driverProfile: true } } },
    });
    if (!referral || referral.status !== ReferralStatus.PENDING) return;

    const customer = await this.prisma.customerProfile.findUnique({
      where: { userId: customerUserId },
      select: { id: true },
    });
    // Un chauffeur ne paie jamais de prestation — rien à détecter ici pour un filleul chauffeur.
    if (!customer) return;

    const [confirmedBookings, confirmedShipments] = await Promise.all([
      this.prisma.booking.count({
        where: { customerId: customer.id, status: { notIn: [BookingStatus.PENDING_PAYMENT, BookingStatus.CANCELLED] } },
      }),
      this.prisma.shipment.count({
        where: { customerId: customer.id, status: { notIn: [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED] } },
      }),
    ]);
    if (confirmedBookings + confirmedShipments !== 1) return;

    const defaultReward = await this.pricing.getNumericSetting('referral.reward_amount', 10000);
    const rewardAmount = BigInt(Math.round(defaultReward));

    if (referral.referrer.driverProfile) {
      await this.wallets.adjustBalance(
        referral.referrer.driverProfile.id,
        rewardAmount.toString(),
        `Récompense de parrainage automatique (référence ${referral.id})`,
        referral.referrerId,
      );
    }

    await this.prisma.referral.update({
      where: { id: referral.id },
      data: { status: ReferralStatus.COMPLETED, rewardAmount, completedAt: new Date() },
    });
  }

  async getOrCreateMyCode(userId: string): Promise<string> {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } });
    if (user.referralCode) return user.referralCode;

    // Boucle courte : une collision est improbable (8 caractères alphanumériques),
    // mais on ne laisse jamais deux utilisateurs partager un code.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const code = this.generateCode();
      try {
        await this.prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
        return code;
      } catch {
        continue;
      }
    }
    throw new ConflictException("Impossible de générer un code de parrainage — réessayez.");
  }

  /**
   * Un nouvel utilisateur saisit le code d'un parrain — une seule fois, à
   * l'inscription (jamais après : Referral.refereeId est unique). Appel
   * distinct de la vérification OTP, pour ne pas complexifier ce parcours
   * déjà critique — le mobile appelle cette route juste après la création
   * du profil, si un code a été saisi.
   */
  async applyCode(refereeUserId: string, code: string): Promise<void> {
    const referrer = await this.prisma.user.findUnique({ where: { referralCode: code.toUpperCase() } });
    if (!referrer) throw new NotFoundException('Code de parrainage introuvable.');
    if (referrer.id === refereeUserId) {
      throw new BadRequestException('Vous ne pouvez pas utiliser votre propre code.');
    }

    const existing = await this.prisma.referral.findUnique({ where: { refereeId: refereeUserId } });
    if (existing) throw new ConflictException('Un code de parrainage a déjà été utilisé pour ce compte.');

    await this.prisma.referral.create({
      data: { referrerId: referrer.id, refereeId: refereeUserId, status: ReferralStatus.PENDING },
    });
  }

  /** Les parrainages envoyés par cet utilisateur, avec leur statut. */
  findMine(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where = { referrerId: userId };
    return Promise.all([
      this.prisma.referral.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: {
          referee: {
            select: { customerProfile: { select: { firstName: true, lastName: true } }, driverProfile: { select: { firstName: true, lastName: true } } },
          },
        },
      }),
      this.prisma.referral.count({ where }),
    ]).then(([data, total]) => new PaginatedResult(data, total, query.page, query.limit));
  }

  /** Vue admin : avec l'identité du parrain et du filleul (jamais leurs coordonnées de paiement). */
  findAll(query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const personSelect = {
      phone: true,
      customerProfile: { select: { firstName: true, lastName: true } },
      driverProfile: { select: { firstName: true, lastName: true } },
    } as const;
    return Promise.all([
      this.prisma.referral.findMany({
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { referrer: { select: personSelect }, referee: { select: personSelect } },
      }),
      this.prisma.referral.count(),
    ]).then(([data, total]) => new PaginatedResult(data, total, query.page, query.limit));
  }

  /** Réservé à l'admin : valide un parrainage et crédite le parrain s'il est chauffeur. */
  async complete(id: string, rewardAmount: string, actorId: string) {
    const referral = await this.prisma.referral.findUnique({
      where: { id },
      include: { referrer: { include: { driverProfile: true } } },
    });
    if (!referral) throw new NotFoundException('Parrainage introuvable.');
    if (referral.status === ReferralStatus.COMPLETED) {
      throw new ConflictException('Ce parrainage a déjà été validé.');
    }

    const amount = BigInt(rewardAmount);
    if (referral.referrer.driverProfile) {
      await this.wallets.adjustBalance(
        referral.referrer.driverProfile.id,
        amount.toString(),
        `Récompense de parrainage (référence ${referral.id})`,
        actorId,
      );
    }

    return this.prisma.referral.update({
      where: { id },
      data: { status: ReferralStatus.COMPLETED, rewardAmount: amount, completedAt: new Date() },
    });
  }

  private generateCode(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sans caractères ambigus (0/O, 1/I)
    let code = '';
    for (let i = 0; i < 8; i += 1) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return code;
  }
}