// backend/src/conversations/conversations.service.ts
// [21/09/2026] v2 — conversation d'un envoi via Shipment.driverId (conducteur avec ou sans trajet).
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationChannel, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * Section 23 : chat Client <-> Conducteur, avec possibilité d'intervention
 * du support. Une Conversation appartient toujours exactement à un
 * client et un conducteur (champs directs sur le modèle, pas de table de
 * participants — décision Lot 1) ; l'accès support est gouverné par la
 * permission CONVERSATION_READ (RBAC, Lot 1) plutôt que par le type de
 * compte brut — cohérent avec le reste de l'application (BOOKING_READ,
 * SHIPMENT_READ...). Un message envoyé par un titulaire de cette
 * permission qui n'est ni le client ni le conducteur est marqué
 * isSupportIntervention.
 */
@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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
      include: { customer: true, driver: true },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    if (!shipment.driver) {
      throw new ForbiddenException("Aucun conducteur n'est encore assigné à cet envoi.");
    }
    this.assertParty(requesterUserId, shipment.customer.userId, shipment.driver.userId);

    const existing = await this.prisma.conversation.findFirst({ where: { shipmentId } });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        shipmentId,
        customerId: shipment.customerId,
        driverId: shipment.driver.id,
      },
    });
  }

  private assertParty(requesterUserId: string, customerUserId: string, driverUserId: string): void {
    if (requesterUserId !== customerUserId && requesterUserId !== driverUserId) {
      throw new ForbiddenException("Vous n'êtes pas partie à cette conversation.");
    }
  }

  /**
   * Liste des conversations de l'utilisateur. Pour que l'écran « Messages » parle autrement que par « Trajet » / « Envoi », chaque
   * ligne porte, EN PLUS des champs historiques (qui restent, pour les anciennes versions de l'app) :
   *  - `counterpart` : prénom et nom de l'autre personne (jamais son identifiant ni son téléphone) ;
   *  - `lastMessage` : aperçu du dernier message, `fromMe` dit si c'est l'utilisateur qui l'a écrit ;
   *  - `unreadCount` : messages de l'autre partie pas encore lus (même critère que markRead) ;
   *  - `booking.trip` / `shipment.trip` : villes de départ et d'arrivée, pour afficher l'itinéraire.
   */
  async findMine(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where = {
      OR: [{ customer: { userId } }, { driver: { userId } }],
    };
    const tripCities = {
      select: {
        originCity: { select: { name: true } },
        destinationCity: { select: { name: true } },
      },
    };
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: { include: { trip: tripCities } },
          shipment: { include: { trip: tripCities } },
          customer: { select: { userId: true, firstName: true, lastName: true } },
          driver: { select: { userId: true, firstName: true, lastName: true } },
          messages: {
            orderBy: { sentAt: 'desc' },
            take: 1,
            select: { content: true, sentAt: true, senderId: true, isSupportIntervention: true },
          },
          _count: { select: { messages: { where: { senderId: { not: userId }, readAt: null } } } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    const data = rows.map(({ customer, driver, messages, _count, ...conversation }) => {
      const other = driver.userId === userId ? customer : driver;
      const last = messages[0];
      return {
        ...conversation,
        counterpart: { firstName: other.firstName, lastName: other.lastName },
        lastMessage: last
          ? {
              content: last.content,
              sentAt: last.sentAt,
              fromMe: last.senderId === userId,
              isSupportIntervention: last.isSupportIntervention,
            }
          : null,
        unreadCount: _count.messages,
      };
    });
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** La réservation est COMPLETED, ou l'envoi DELIVERED / COMPLETED : plus d'échange direct entre le client et le conducteur. */
  private async isConversationClosed(conversation: { bookingId: string | null; shipmentId: string | null }): Promise<boolean> {
    if (conversation.bookingId) {
      const booking = await this.prisma.booking.findUnique({ where: { id: conversation.bookingId }, select: { status: true } });
      return booking?.status === 'COMPLETED';
    }
    if (conversation.shipmentId) {
      const shipment = await this.prisma.shipment.findUnique({ where: { id: conversation.shipmentId }, select: { status: true } });
      return shipment?.status === 'DELIVERED' || shipment?.status === 'COMPLETED';
    }
    return false;
  }

  private async findConversationWithParties(conversationId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { customer: true, driver: true },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable.');
    return conversation;
  }

  /**
   * Détail d'UNE conversation — jusqu'ici absent de l'API : le client
   * mobile ne pouvait afficher qu'un titre générique ("Conversation"),
   * faute de savoir avec qui il échangeait ou à quel trajet/envoi ça se
   * rapportait. `select` explicite (jamais `include: true`) pour ne
   * renvoyer que prénom/nom des deux parties — jamais mobileMoneyNumber,
   * dateOfBirth, address ou tout autre champ sensible de leur profil.
   */
  async findOne(conversationId: string, requesterUserId: string, hasSupportAccess: boolean) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        bookingId: true,
        shipmentId: true,
        createdAt: true,
        customer: { select: { id: true, userId: true, firstName: true, lastName: true } },
        driver: { select: { id: true, userId: true, firstName: true, lastName: true } },
        booking: {
          select: {
            id: true,
            trip: {
              select: {
                originCity: { select: { name: true } },
                destinationCity: { select: { name: true } },
              },
            },
          },
        },
        shipment: {
          select: { id: true, senderName: true, recipientName: true },
        },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation introuvable.');

    if (
      !hasSupportAccess &&
      requesterUserId !== conversation.customer.userId &&
      requesterUserId !== conversation.driver.userId
    ) {
      throw new ForbiddenException("Vous n'êtes pas partie à cette conversation.");
    }

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

    // Trajet terminé ou colis livré : le client et le conducteur ne s'écrivent plus (comme pour l'appel et le SMS). L'historique
    // reste lisible ; le support, lui, peut toujours écrire.
    if (!isSupportIntervention && (await this.isConversationClosed(conversation))) {
      throw new ForbiddenException(
        "Cette conversation est fermée : la prestation est terminée. En cas de problème, utilisez « Signaler un problème ».",
      );
    }

    if (
      !sender.hasSupportAccess &&
      sender.id !== conversation.customer.userId &&
      sender.id !== conversation.driver.userId
    ) {
      throw new ForbiddenException("Vous n'êtes pas partie à cette conversation.");
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId,
        senderId: sender.id,
        content,
        isSupportIntervention,
      },
    });

    await this.notifyOtherParty(conversation, sender.id, content);

    return message;
  }

  /**
   * Alerte push l'autre partie — jamais l'expéditeur lui-même. En push
   * uniquement (jamais SMS/email) : c'est un message de conversation
   * ordinaire, pas un événement métier critique — le push suffit pour
   * l'alerte "à l'écran d'accueil, avec son" demandée côté client. Une
   * intervention support (l'expéditeur n'est ni le client ni le
   * conducteur) prévient les deux parties à la fois.
   */
  private async notifyOtherParty(
    conversation: {
      id: string;
      customer: { userId: string; firstName: string };
      driver: { userId: string; firstName: string };
    },
    senderId: string,
    content: string,
  ): Promise<void> {
    const isCustomerSender = senderId === conversation.customer.userId;
    const isDriverSender = senderId === conversation.driver.userId;

    const recipientUserIds = isCustomerSender
      ? [conversation.driver.userId]
      : isDriverSender
        ? [conversation.customer.userId]
        : [conversation.customer.userId, conversation.driver.userId];

    const senderName = isCustomerSender
      ? conversation.customer.firstName
      : isDriverSender
        ? conversation.driver.firstName
        : 'Le support';

    const body = content.length > 140 ? `${content.slice(0, 140)}…` : content;

    await Promise.all(
      recipientUserIds.map((userId) =>
        this.notifications.notify({
          userId,
          type: NotificationType.CONVERSATION_MESSAGE,
          channels: [NotificationChannel.PUSH],
          fallbackTitle: senderName,
          fallbackBody: body,
          pushData: { type: 'CONVERSATION_MESSAGE', conversationId: conversation.id },
          // `pushData` n'est transmis qu'au moment de l'envoi push, jamais
          // conservé sur la ligne Notification — sans `payload` ici,
          // l'écran d'accueil (qui interroge GET /notifications/mine plus
          // tard) n'aurait aucun moyen de savoir vers quelle conversation
          // ouvrir la carte d'alerte.
          payload: { conversationId: conversation.id },
        }),
      ),
    );
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