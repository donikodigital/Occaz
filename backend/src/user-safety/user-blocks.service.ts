// backend/src/user-safety/user-blocks.service.ts
// [11/10/2026] v1 — blocage d'un utilisateur. Le blocage joue dans les deux sens : ni réservation, ni invitation de colis, ni message
// entre les deux comptes. Il ne touche pas à ce qui est déjà réservé (c'est l'affaire du support). Les refus ne disent jamais QUI a bloqué.
import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AccountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { shortName } from './user-safety.utils';

export const BLOCKED_MESSAGE = "Cette action n'est pas possible avec cet utilisateur.";

@Injectable()
export class UserBlocksService {
  constructor(private readonly prisma: PrismaService) {}

  /** Retrouve le compte visé à partir d'UNE référence : compte, profil conducteur ou profil client. */
  async resolveTargetUserId(target: { userId?: string; driverId?: string; customerId?: string }): Promise<string> {
    const given = [target.userId, target.driverId, target.customerId].filter(Boolean);
    if (given.length !== 1) {
      throw new BadRequestException('Indiquez la personne concernée (userId, driverId ou customerId — un seul).');
    }
    if (target.userId) return target.userId;
    const profile = target.driverId
      ? await this.prisma.driverProfile.findUnique({ where: { id: target.driverId }, select: { userId: true } })
      : await this.prisma.customerProfile.findUnique({ where: { id: target.customerId! }, select: { userId: true } });
    if (!profile) throw new NotFoundException('Utilisateur introuvable.');
    return profile.userId;
  }

  async block(blockerId: string, blockedId: string): Promise<{ blocked: true }> {
    if (blockerId === blockedId) throw new BadRequestException('Vous ne pouvez pas vous bloquer vous-même.');
    const target = await this.prisma.user.findFirst({
      where: { id: blockedId, deletedAt: null },
      select: { id: true, accountType: true },
    });
    if (!target) throw new NotFoundException('Utilisateur introuvable.');
    if (target.accountType === AccountType.SUPPORT || target.accountType === AccountType.SUPERADMIN) {
      throw new ForbiddenException('Ce compte ne peut pas être bloqué.');
    }
    await this.prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId, blockedId } },
      create: { blockerId, blockedId },
      update: {},
    });
    return { blocked: true };
  }

  async unblock(blockerId: string, blockedId: string): Promise<{ blocked: false }> {
    await this.prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
    return { blocked: false };
  }

  /** Les personnes que j'ai bloquées (jamais l'inverse : on ne dit pas à quelqu'un qu'il a été bloqué). */
  async listMine(userId: string) {
    const blocks = await this.prisma.userBlock.findMany({
      where: { blockerId: userId },
      orderBy: { createdAt: 'desc' },
      include: {
        blocked: {
          select: {
            id: true,
            accountType: true,
            customerProfile: { select: { firstName: true, lastName: true } },
            driverProfile: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    return blocks.map((block) => ({
      id: block.id,
      userId: block.blocked.id,
      name: shortName(block.blocked),
      accountType: block.blocked.accountType,
      createdAt: block.createdAt,
    }));
  }

  /** Vrai si l'un des deux a bloqué l'autre. */
  async isBlockedBetween(userA: string, userB: string): Promise<boolean> {
    if (userA === userB) return false;
    const count = await this.prisma.userBlock.count({
      where: {
        OR: [
          { blockerId: userA, blockedId: userB },
          { blockerId: userB, blockedId: userA },
        ],
      },
    });
    return count > 0;
  }

  async assertNotBlocked(userA: string, userB: string): Promise<void> {
    if (await this.isBlockedBetween(userA, userB)) throw new ForbiddenException(BLOCKED_MESSAGE);
  }

  /** Un client ne peut pas réserver chez un conducteur qu'il a bloqué, ni chez un conducteur qui l'a bloqué. */
  async assertCanBookTrip(customerUserId: string, tripId: string): Promise<void> {
    const trip = await this.prisma.trip.findUnique({
      where: { id: tripId },
      select: { driver: { select: { userId: true } } },
    });
    // Trajet introuvable : le service de réservation répondra 404 comme d'habitude.
    if (!trip) return;
    await this.assertNotBlocked(customerUserId, trip.driver.userId);
  }

  /** Retire des trajets proposés pour un colis ceux dont le conducteur est bloqué (dans un sens ou dans l'autre). */
  async filterTripIdsForCustomer(customerUserId: string, tripIds: string[]): Promise<string[]> {
    if (tripIds.length === 0) return tripIds;
    const blocks = await this.prisma.userBlock.findMany({
      where: { OR: [{ blockerId: customerUserId }, { blockedId: customerUserId }] },
      select: { blockerId: true, blockedId: true },
    });
    if (blocks.length === 0) return tripIds;
    const blockedUserIds = new Set(blocks.map((block) => (block.blockerId === customerUserId ? block.blockedId : block.blockerId)));
    const trips = await this.prisma.trip.findMany({
      where: { id: { in: tripIds } },
      select: { id: true, driver: { select: { userId: true } } },
    });
    const allowed = new Set(trips.filter((trip) => !blockedUserIds.has(trip.driver.userId)).map((trip) => trip.id));
    return tripIds.filter((id) => allowed.has(id));
  }

  /** Un conducteur n'accepte pas l'envoi d'un client qu'il a bloqué (ni d'un client qui l'a bloqué). */
  async assertCanAcceptShipment(driverUserId: string, shipmentId: string): Promise<void> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      select: { customer: { select: { userId: true } } },
    });
    if (!shipment) return;
    await this.assertNotBlocked(driverUserId, shipment.customer.userId);
  }

  /** Même contrôle pour une invitation : le conducteur ne répond pas à l'invitation d'un client bloqué. */
  async assertCanAcceptInvitation(driverUserId: string, invitationId: string): Promise<void> {
    const invitation = await this.prisma.shipmentInvitation.findUnique({
      where: { id: invitationId },
      select: { shipment: { select: { customer: { select: { userId: true } } } } },
    });
    if (!invitation) return;
    await this.assertNotBlocked(driverUserId, invitation.shipment.customer.userId);
  }

  /** Aucun message entre deux comptes dont l'un a bloqué l'autre. */
  async assertCanMessage(senderUserId: string, conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { customer: { select: { userId: true } }, driver: { select: { userId: true } } },
    });
    if (!conversation) return;
    const customerUserId = conversation.customer.userId;
    const driverUserId = conversation.driver.userId;
    // Un agent du support n'est ni l'un ni l'autre : ses messages ne sont jamais bloqués.
    let otherUserId: string;
    if (senderUserId === customerUserId) otherUserId = driverUserId;
    else if (senderUserId === driverUserId) otherUserId = customerUserId;
    else return;
    await this.assertNotBlocked(senderUserId, otherUserId);
  }
}
