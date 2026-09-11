// backend/src/conversations/conversations.service.ts
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';

/**
 * Section 23 : chat Client <-> Chauffeur, avec possibilité d'intervention
 * du support. Une Conversation appartient toujours exactement à un
 * client et un chauffeur (champs directs sur le modèle, pas de table de
 * participants — décision Lot 1) ; l'accès support est gouverné par la
 * permission CONVERSATION_READ (RBAC, Lot 1) plutôt que par le type de
 * compte brut — cohérent avec le reste de l'application (BOOKING_READ,
 * SHIPMENT_READ...). Un message envoyé par un titulaire de cette
 * permission qui n'est ni le client ni le chauffeur est marqué
 * isSupportIntervention.
 */
@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreateForBooking(bookingId: string, requesterUserId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, trip: { include: { driver: true } } },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    this.assertParty(requesterUserId, booking.customer.userId, booking.trip.driver.userId);

    const existing = await this.prisma.conversation.findFirst({ where: { bookingId } });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        bookingId,
        customerId: booking.customerId,
        driverId: booking.trip.driverId,
      },
    });
  }

  async getOrCreateForShipment(shipmentId: string, requesterUserId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, trip: { include: { driver: true } } },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    if (!shipment.trip) {
      throw new ForbiddenException("Aucun chauffeur n'est encore assigné à cet envoi.");
    }
    this.assertParty(requesterUserId, shipment.customer.userId, shipment.trip.driver.userId);

    const existing = await this.prisma.conversation.findFirst({ where: { shipmentId } });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        shipmentId,
        customerId: shipment.customerId,
        driverId: shipment.trip.driverId,
      },
    });
  }

  private assertParty(requesterUserId: string, customerUserId: string, driverUserId: string): void {
    if (requesterUserId !== customerUserId && requesterUserId !== driverUserId) {
      throw new ForbiddenException("Vous n'êtes pas partie à cette conversation.");
    }
  }

  async findMine(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where = {
      OR: [{ customer: { userId } }, { driver: { userId } }],
    };
    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { booking: true, shipment: true },
      }),
      this.prisma.conversation.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  private async findConversationWithParties(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { customer: true, driver: true },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    return conversation;
  }

  async sendMessage(
    conversationId: string,
    sender: { id: string; hasSupportAccess: boolean },
    content: string,
  ) {
    const conversation = await this.findConversationWithParties(conversationId);
    const isSupportIntervention =
      sender.hasSupportAccess &&
      sender.id !== conversation.customer.userId &&
      sender.id !== conversation.driver.userId;

    if (
      !sender.hasSupportAccess &&
      sender.id !== conversation.customer.userId &&
      sender.id !== conversation.driver.userId
    ) {
      throw new ForbiddenException("Vous n'êtes pas partie à cette conversation.");
    }

    return this.prisma.message.create({
      data: {
        conversationId,
        senderId: sender.id,
        content,
        isSupportIntervention,
      },
    });
  }

  async findMessages(
    conversationId: string,
    requesterUserId: string,
    hasSupportAccess: boolean,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const conversation = await this.findConversationWithParties(conversationId);
    if (
      !hasSupportAccess &&
      requesterUserId !== conversation.customer.userId &&
      requesterUserId !== conversation.driver.userId
    ) {
      throw new ForbiddenException("Vous n'êtes pas partie à cette conversation.");
    }

    const where = { conversationId };
    const [data, total] = await Promise.all([
      this.prisma.message.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { sentAt: 'desc' },
        include: { sender: true },
      }),
      this.prisma.message.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.findConversationWithParties(conversationId);
    await this.prisma.message.updateMany({
      where: { conversationId, senderId: { not: userId }, readAt: null },
      data: { readAt: new Date() },
    });
  }
}
