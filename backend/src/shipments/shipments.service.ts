// backend/src/shipments/shipments.service.ts
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CancellationInitiator,
  DocumentOwnerType,
  NotificationChannel,
  NotificationType,
  Prisma,
  ServiceType,
  ShipmentStatus,
  TripStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { WalletsService } from '../wallets/wallets.service';
import { ShipmentCategoriesService } from '../shipment-categories/shipment-categories.service';
import { DocumentsService } from '../documents/documents.service';
import { CreateDocumentDto } from '../documents/dto/create-document.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { toMoneyBigInt } from '../common/utils/money.util';
import { DOMAIN_EVENTS, ShipmentCancelledEvent } from '../common/events/domain-events';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { SearchAvailableShipmentsDto } from './dto/search-available-shipments.dto';

/**
 * NB sur le cycle de vie (section 20), même principe que TripsService
 * (voir la discussion du Lot 3, confirmée) : le chauffeur ne peut jamais
 * s'auto-valider. Ce Lot implémente CREATED -> SEARCHING_DRIVER ->
 * DRIVER_ASSIGNED -> CANCELLED. Les étapes PICKUP_PENDING -> PICKED_UP ->
 * IN_TRANSIT -> DELIVERY_PENDING -> DELIVERED -> COMPLETED exigent une
 * validation OTP (section 17, OTP récupération / livraison) et sont
 * implémentées au Lot 6. En cas de désaccord chauffeur/client à n'importe
 * quelle étape, le recours est un Dispute (section 21, Lot 7) — jamais
 * une validation manuelle côté chauffeur.
 */
@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly categories: ShipmentCategoriesService,
    private readonly documentsService: DocumentsService,
    private readonly wallets: WalletsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly notifications: NotificationsService,
  ) {}

  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        trip: { include: { driver: true } },
        category: true,
        senderLocation: true,
        recipientLocation: true,
        items: true,
        tracking: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    return shipment;
  }

  async create(customerId: string, dto: CreateShipmentDto) {
    const category = await this.categories.findOne(dto.categoryId);
    if (!category.isAllowed) {
      throw new BadRequestException(
        `La catégorie "${category.name}" n'est pas autorisée pour les envois.`,
      );
    }

    const declaredValue = dto.declaredValue ? toMoneyBigInt(dto.declaredValue) : undefined;
    if (declaredValue !== undefined && category.maxDeclaredValue !== null && category.maxDeclaredValue !== undefined) {
      if (declaredValue > category.maxDeclaredValue) {
        throw new BadRequestException(
          `La valeur déclarée dépasse le maximum autorisé pour cette catégorie.`,
        );
      }
    }

    const senderLocation = await this.prisma.location.findUnique({
      where: { id: dto.senderLocationId },
      include: { city: { include: { country: true } } },
    });
    if (!senderLocation) throw new NotFoundException("Localisation de l'expéditeur introuvable.");
    const recipientLocation = await this.prisma.location.findUnique({
      where: { id: dto.recipientLocationId },
    });
    if (!recipientLocation) throw new NotFoundException('Localisation du destinataire introuvable.');

    const price = await this.pricing.computeShipmentPrice({
      weightKg: dto.weightKg,
      isUrgent: dto.isUrgent ?? false,
      categoryPriceMultiplier: category.priceMultiplier,
      senderLocationId: dto.senderLocationId,
      recipientLocationId: dto.recipientLocationId,
    });
    const platformFee = await this.pricing.computeCommission({
      serviceType: ServiceType.SHIPMENT,
      countryId: senderLocation.city?.countryId ?? null,
      baseAmount: price,
    });
    const totalAmount = price + platformFee;
    // Un envoi ne référence qu'une seule devise (celle du pays d'expédition) —
    // la valeur déclarée est supposée exprimée dans cette même devise.
    const currencyId = senderLocation.city?.country?.defaultCurrencyId;
    if (!currencyId) {
      throw new BadRequestException(
        "Impossible de déterminer la devise : la ville d'expédition n'a pas de pays avec devise par défaut configurée.",
      );
    }

    let trip: {
      id: string;
      status: TripStatus;
      allowsShipments: boolean;
      availableShipmentWeightKg: number | null;
    } | null = null;
    if (dto.tripId) {
      trip = await this.prisma.trip.findUnique({ where: { id: dto.tripId } });
      if (!trip) throw new NotFoundException('Trajet introuvable.');
      if (trip.status !== TripStatus.PUBLISHED || !trip.allowsShipments) {
        throw new BadRequestException("Ce trajet n'accepte pas d'envois pour le moment.");
      }
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (trip && trip.availableShipmentWeightKg !== null) {
        const capacityUpdate = await tx.trip.updateMany({
          where: {
            id: trip.id,
            status: TripStatus.PUBLISHED,
            availableShipmentWeightKg: { gte: dto.weightKg },
          },
          data: { availableShipmentWeightKg: { decrement: dto.weightKg } },
        });
        if (capacityUpdate.count === 0) {
          throw new ConflictException("Plus assez de capacité de transport sur ce trajet.");
        }
      }

      const shipment = await tx.shipment.create({
        data: {
          tripId: trip?.id,
          customerId,
          categoryId: dto.categoryId,
          senderName: dto.senderName,
          senderPhone: dto.senderPhone,
          senderLocationId: dto.senderLocationId,
          recipientName: dto.recipientName,
          recipientPhone: dto.recipientPhone,
          recipientLocationId: dto.recipientLocationId,
          description: dto.description,
          weightKg: dto.weightKg,
          lengthCm: dto.lengthCm,
          widthCm: dto.widthCm,
          heightCm: dto.heightCm,
          quantity: dto.quantity ?? 1,
          declaredValue,
          instructions: dto.instructions,
          isUrgent: dto.isUrgent ?? false,
          // Toujours CREATED à ce stade, même si un trajet est déjà choisi
          // (tripId posé ci-dessus) : le statut n'avance vers
          // DRIVER_ASSIGNED / SEARCHING_DRIVER qu'une fois le paiement
          // confirmé (confirmPayment, appelé par PaymentsService) — même
          // logique que Booking.PENDING_PAYMENT, pour ne jamais bloquer de
          // capacité de transport pour un envoi qui ne sera peut-être
          // jamais payé.
          status: ShipmentStatus.CREATED,
          price,
          platformFee,
          totalAmount,
          currencyId,
        },
      });

      if (dto.items?.length) {
        await tx.shipmentItem.createMany({
          data: dto.items.map((item) => ({
            shipmentId: shipment.id,
            label: item.label,
            weightKg: item.weightKg,
            photoUrl: item.photoUrl,
          })),
        });
      }

      await tx.shipmentTracking.create({
        data: { shipmentId: shipment.id, status: shipment.status },
      });

      return tx.shipment.findUnique({
        where: { id: shipment.id },
        include: { items: true, tracking: true },
      });
    });
  }

  /**
   * À appeler par le webhook de paiement (Lot 5) une fois le paiement
   * confirmé côté serveur — jamais depuis une route publique (règle
   * d'or, section 13). Fait avancer CREATED vers DRIVER_ASSIGNED (si un
   * trajet avait déjà été choisi à la création) ou SEARCHING_DRIVER.
   */
  async confirmPayment(id: string): Promise<void> {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({ where: { id } });
    if (shipment.status !== ShipmentStatus.CREATED) return; // déjà traité, idempotent

    const nextStatus = shipment.tripId ? ShipmentStatus.DRIVER_ASSIGNED : ShipmentStatus.SEARCHING_DRIVER;
    await this.prisma.$transaction([
      this.prisma.shipment.update({ where: { id }, data: { status: nextStatus } }),
      this.prisma.shipmentTracking.create({ data: { shipmentId: id, status: nextStatus } }),
    ]);
  }

  /**
   * Un chauffeur accepte un envoi en recherche (section 12 : ACCEPTER /
   * REFUSER) en le rattachant à l'un de ses propres trajets publiés.
   * Le paiement est nécessairement déjà capturé à ce stade : un envoi
   * n'atteint SEARCHING_DRIVER qu'après confirmation de paiement (voir
   * confirmPayment) — le provisionnement du portefeuille chauffeur peut
   * donc se faire ici sans re-vérification.
   */
  async assignToTrip(shipmentId: string, tripId: string, driverId: string) {
    const shipment = await this.findOne(shipmentId);
    if (shipment.status !== ShipmentStatus.SEARCHING_DRIVER) {
      throw new BadRequestException("Cet envoi n'est plus disponible.");
    }

    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip) throw new NotFoundException('Trajet introuvable.');
    if (trip.driverId !== driverId) {
      throw new ForbiddenException("Ce trajet n'appartient pas à ce chauffeur.");
    }
    if (trip.status !== TripStatus.PUBLISHED || !trip.allowsShipments) {
      throw new BadRequestException("Ce trajet n'accepte pas d'envois pour le moment.");
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (trip.availableShipmentWeightKg !== null) {
        const capacityUpdate = await tx.trip.updateMany({
          where: {
            id: tripId,
            status: TripStatus.PUBLISHED,
            availableShipmentWeightKg: { gte: shipment.weightKg },
          },
          data: { availableShipmentWeightKg: { decrement: shipment.weightKg } },
        });
        if (capacityUpdate.count === 0) {
          throw new ConflictException('Plus assez de capacité de transport sur ce trajet.');
        }
      }

      const result = await tx.shipment.update({
        where: { id: shipmentId },
        data: { tripId, status: ShipmentStatus.DRIVER_ASSIGNED },
      });

      await tx.shipmentTracking.create({
        data: { shipmentId, status: ShipmentStatus.DRIVER_ASSIGNED },
      });

      return result;
    });

    await this.wallets.holdShipmentRevenue({
      driverId,
      shipmentId,
      grossAmount: (shipment.totalAmount as bigint) - (shipment.platformFee as bigint),
      commission: shipment.platformFee,
    });

    const customer = await this.prisma.customerProfile.findUnique({
      where: { id: shipment.customerId },
      select: { userId: true },
    });
    if (customer) {
      await this.notifications.notify({
        userId: customer.userId,
        type: NotificationType.DRIVER_ACCEPTED,
        channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
        fallbackTitle: 'Chauffeur trouvé',
        fallbackBody: 'Un chauffeur a accepté de transporter votre envoi.',
      });
    }

    return updated;
  }

  async cancel(
    id: string,
    reason: string,
    cancelledBy: CancellationInitiator,
    requester?: { customerId?: string; driverId?: string },
  ) {
    const shipment = await this.findOne(id);
    if (requester?.customerId && shipment.customerId !== requester.customerId) {
      throw new ForbiddenException("Cet envoi n'appartient pas à ce client.");
    }
    if (requester?.driverId) {
      const shipmentTripDriverId = (shipment as unknown as { trip: { driverId: string } | null }).trip
        ?.driverId;
      if (shipmentTripDriverId !== requester.driverId) {
        throw new ForbiddenException("Cet envoi n'est pas assigné à ce chauffeur.");
      }
    }
    if (
      shipment.status === ShipmentStatus.CANCELLED ||
      shipment.status === ShipmentStatus.COMPLETED ||
      shipment.status === ShipmentStatus.DELIVERED
    ) {
      throw new BadRequestException('Cet envoi ne peut plus être annulé.');
    }

    // Remboursement à 100% si l'annulation n'est pas du fait du client
    // (chauffeur ou système) — sinon la politique d'annulation habituelle
    // s'applique, basée sur le délai avant récupération. Faute de date de
    // récupération planifiée sur Shipment (contrairement à
    // Trip.departureAt), le délai est évalué par rapport à la création de
    // l'envoi : un envoi tout juste créé reste dans la fenêtre de
    // remboursement intégral la plupart du temps.
    let refundEligiblePercentage: number | null = 100;
    if (cancelledBy === CancellationInitiator.CUSTOMER) {
      const senderLocation = await this.prisma.location.findUnique({
        where: { id: (shipment as unknown as { senderLocationId: string }).senderLocationId },
        include: { city: true },
      });
      const policy = await this.pricing.getCancellationPolicy({
        serviceType: ServiceType.SHIPMENT,
        countryId: senderLocation?.city?.countryId ?? null,
      });
      const hoursSinceCreation =
        (Date.now() - (shipment as unknown as { createdAt: Date }).createdAt.getTime()) / 3_600_000;
      refundEligiblePercentage = policy
        ? hoursSinceCreation <= policy.hoursBeforeDeparture
          ? policy.refundPercentage
          : 0
        : null;
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      if (shipment.tripId) {
        const trip = await tx.trip.findUnique({ where: { id: shipment.tripId } });
        if (trip && trip.availableShipmentWeightKg !== null) {
          await tx.trip.update({
            where: { id: shipment.tripId },
            data: { availableShipmentWeightKg: { increment: shipment.weightKg } },
          });
        }
      }

      const result = await tx.shipment.update({
        where: { id },
        data: {
          status: ShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy,
          cancellationReason: reason,
        },
      });

      await tx.shipmentTracking.create({
        data: { shipmentId: id, status: ShipmentStatus.CANCELLED, note: reason },
      });

      return result;
    });

    this.eventEmitter.emit(
      DOMAIN_EVENTS.SHIPMENT_CANCELLED,
      new ShipmentCancelledEvent(id, reason, refundEligiblePercentage),
    );

    return { ...updated, refundEligiblePercentage };
  }

  async findMineForCustomer(
    customerId: string,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const where = { customerId };
    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { category: true, trip: true },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  async findAllForDriverTrips(driverId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where = { trip: { driverId } };
    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { category: true, trip: true },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  /** Envois en recherche de chauffeur (section 12), filtrables par ville. */
  async findAvailable(dto: SearchAvailableShipmentsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ShipmentWhereInput = {
      status: ShipmentStatus.SEARCHING_DRIVER,
      ...(dto.originCityId ? { senderLocation: { cityId: dto.originCityId } } : {}),
      ...(dto.destinationCityId ? { recipientLocation: { cityId: dto.destinationCityId } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'asc' },
        include: { category: true, senderLocation: true, recipientLocation: true },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return new PaginatedResult(data, total, dto.page, dto.limit);
  }

  async findAll(
    query: PaginationQueryDto,
    filters: { status?: ShipmentStatus } = {},
  ): Promise<PaginatedResult<unknown>> {
    const where = { status: filters.status };
    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { category: true, trip: true },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  // -----------------------------------------------------------------------
  // Preuves photographiques (section 62) — avant/après récupération,
  // livraison. Indépendant de la validation OTP (Lot 6) : une photo peut
  // être versée au dossier à tout moment par le client ou le chauffeur
  // assigné.
  // -----------------------------------------------------------------------

  async uploadEvidence(shipmentId: string, dto: CreateDocumentDto) {
    await this.findOne(shipmentId);
    return this.documentsService.create(DocumentOwnerType.SHIPMENT, shipmentId, dto);
  }

  findEvidence(shipmentId: string) {
    return this.documentsService.findAllForOwner(DocumentOwnerType.SHIPMENT, shipmentId);
  }
}
