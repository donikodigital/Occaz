// backend/src/shipments/shipments.service.ts
// [21/09/2026] v2 — plage de dates, prix unique, acceptation atomique (premier arrivé), chauffeur sans trajet, annulation remboursée à 100 %, prolongation, expiration ; profil chauffeur limité aux champs publics.
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
  DriverAccountStatus,
  NotificationChannel,
  NotificationType,
  Prisma,
  ServiceType,
  ShipmentStatus,
  Trip,
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
import {
  DOMAIN_EVENTS,
  ShipmentCancelledEvent,
  ShipmentSearchOpenedEvent,
} from '../common/events/domain-events';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { QuoteShipmentDto } from './dto/quote-shipment.dto';
import { SearchAvailableShipmentsDto } from './dto/search-available-shipments.dto';
import { toAvailableShipmentView } from './shipment-views';

/**
 * Jusqu'à quel statut le client ou le chauffeur peuvent annuler. Une fois
 * le colis récupéré, l'annulation (remboursée à 100 %) permettrait de
 * garder un colis en route et de récupérer son argent : le recours devient
 * un litige (section 21).
 */
const CANCELLABLE_BY_PARTIES: ShipmentStatus[] = [
  ShipmentStatus.CREATED,
  ShipmentStatus.SEARCHING_DRIVER,
  ShipmentStatus.DRIVER_ASSIGNED,
  ShipmentStatus.PICKUP_PENDING,
];

/** Toute annulation d'un envoi restitue l'intégralité du montant payé par le client. */
const FULL_REFUND_PERCENTAGE = 100;

/**
 * Champs du profil chauffeur visibles par les parties d'un envoi. Jamais
 * `driver: true` : le profil complet contient le numéro Mobile Money et la
 * référence bancaire du chauffeur.
 */
const PUBLIC_DRIVER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  averageRating: true,
  ratingsCount: true,
} as const;

/**
 * Cycle de vie d'un envoi (section 20) — flux v2 :
 *
 * 1. Le client annonce son colis avec une plage de dates (windowStart /
 *    windowEnd, obligatoires) et paie un seul montant, calculé par le
 *    serveur (PricingService.computeShipmentQuote). CREATED.
 * 2. Le paiement confirmé (confirmPayment), l'envoi passe en
 *    SEARCHING_DRIVER et TOUS les chauffeurs validés sont prévenus à la
 *    fois (ShipmentDispatchService). Le premier à accepter l'emporte
 *    (accept : attribution atomique) et reçoit alors les coordonnées du
 *    client ; son gain est retenu sur son portefeuille.
 * 3. Un chauffeur n'a pas besoin d'avoir un trajet établi pour accepter.
 * 4. Sans chauffeur à la fin de la plage, le client est invité à prolonger
 *    (extendWindow) ; sans réponse il est remboursé à 100 %
 *    (expireSearch, lancé par ShipmentWindowService).
 * 5. DRIVER_ASSIGNED -> PICKUP_PENDING -> PICKED_UP -> IN_TRANSIT ->
 *    DELIVERY_PENDING -> DELIVERED -> COMPLETED exigent une validation OTP
 *    (ShipmentOtpService) : le chauffeur ne peut jamais s'auto-valider. En
 *    cas de désaccord, le recours est un Dispute (section 21).
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
        trip: { include: { driver: { select: PUBLIC_DRIVER_SELECT } } },
        driver: { select: PUBLIC_DRIVER_SELECT },
        category: true,
        currency: { select: { id: true, isoCode: true, symbol: true } },
        senderLocation: true,
        recipientLocation: true,
        items: true,
        tracking: { orderBy: { recordedAt: 'asc' } },
      },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    return shipment;
  }

  // -----------------------------------------------------------------------
  // Devis et création
  // -----------------------------------------------------------------------

  /**
   * Prix affiché au client AVANT paiement. Même calcul que la création
   * (buildQuote) : le montant annoncé est celui qui sera facturé.
   */
  async quote(dto: QuoteShipmentDto) {
    const { quote, currencyId } = await this.buildQuote(dto);
    const currency = await this.prisma.currency.findUnique({ where: { id: currencyId }, select: { isoCode: true } });
    return {
      totalAmount: quote.price,
      currencyId,
      currencyCode: currency?.isoCode ?? null,
      distanceKm: quote.distanceKm,
      chargeableWeightKg: quote.chargeableWeightKg,
      volumetricWeightKg: quote.volumetricWeightKg,
    };
  }

  private async buildQuote(dto: QuoteShipmentDto) {
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

    // Un envoi ne référence qu'une seule devise (celle du pays d'expédition) —
    // la valeur déclarée est supposée exprimée dans cette même devise.
    const currencyId = senderLocation.city?.country?.defaultCurrencyId;
    if (!currencyId) {
      throw new BadRequestException(
        "Impossible de déterminer la devise : la ville d'expédition n'a pas de pays avec devise par défaut configurée.",
      );
    }

    const quote = await this.pricing.computeShipmentQuote({
      weightKg: dto.weightKg,
      lengthCm: dto.lengthCm,
      widthCm: dto.widthCm,
      heightCm: dto.heightCm,
      quantity: dto.quantity,
      declaredValue,
      isUrgent: dto.isUrgent ?? false,
      categoryPriceMultiplier: category.priceMultiplier,
      senderLocationId: dto.senderLocationId,
      recipientLocationId: dto.recipientLocationId,
    });

    return { category, declaredValue, senderLocation, quote, currencyId };
  }

  private parseWindow(windowStart: string, windowEnd: string): { start: Date; end: Date } {
    const start = new Date(windowStart);
    const end = new Date(windowEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('La plage de dates est invalide.');
    }
    if (end <= start) {
      throw new BadRequestException('La fin de la plage doit être postérieure à son début.');
    }
    if (end <= new Date()) {
      throw new BadRequestException('La fin de la plage doit être dans le futur.');
    }
    return { start, end };
  }

  async create(customerId: string, dto: CreateShipmentDto) {
    const { start: windowStart, end: windowEnd } = this.parseWindow(dto.windowStart, dto.windowEnd);
    const { declaredValue, senderLocation, quote, currencyId } = await this.buildQuote(dto);

    // Un seul montant pour le client : c'est le prix calculé. La commission
    // de la plateforme (règle configurée dans l'admin) en est prélevée sur
    // le gain du chauffeur — voir WalletsService.holdShipmentRevenue.
    const totalAmount = quote.price;
    const platformFee = await this.pricing.computeCommission({
      serviceType: ServiceType.SHIPMENT,
      countryId: senderLocation.city?.countryId ?? null,
      baseAmount: totalAmount,
    });

    let trip: {
      id: string;
      driverId: string;
      status: TripStatus;
      allowsShipments: boolean;
      departureAt: Date;
      availableShipmentWeightKg: number | null;
    } | null = null;
    if (dto.tripId) {
      trip = await this.prisma.trip.findUnique({ where: { id: dto.tripId } });
      if (!trip) throw new NotFoundException('Trajet introuvable.');
      if (trip.status !== TripStatus.PUBLISHED || !trip.allowsShipments) {
        throw new BadRequestException("Ce trajet n'accepte pas d'envois pour le moment.");
      }
      if (trip.departureAt < windowStart || trip.departureAt > windowEnd) {
        throw new BadRequestException("Le départ de ce trajet est en dehors de la plage de dates choisie.");
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
          driverId: trip?.driverId,
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
          windowStart,
          windowEnd,
          // Toujours CREATED à ce stade, même si un trajet est déjà choisi
          // (tripId posé ci-dessus) : le statut n'avance vers
          // DRIVER_ASSIGNED / SEARCHING_DRIVER qu'une fois le paiement
          // confirmé (confirmPayment, appelé par PaymentsService) — même
          // logique que Booking.PENDING_PAYMENT. La capacité du trajet, elle,
          // est réservée dès maintenant pour ne jamais accepter un paiement
          // sans place ; un envoi jamais payé la restitue (expireUnpaid).
          status: ShipmentStatus.CREATED,
          price: totalAmount,
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
   * trajet avait déjà été choisi à la création) ou SEARCHING_DRIVER — auquel
   * cas tous les chauffeurs validés sont prévenus.
   */
  async confirmPayment(id: string): Promise<void> {
    const shipment = await this.prisma.shipment.findUniqueOrThrow({ where: { id } });
    if (shipment.status !== ShipmentStatus.CREATED) return; // déjà traité, idempotent

    const nextStatus = shipment.driverId ? ShipmentStatus.DRIVER_ASSIGNED : ShipmentStatus.SEARCHING_DRIVER;
    await this.prisma.$transaction([
      this.prisma.shipment.update({ where: { id }, data: { status: nextStatus } }),
      this.prisma.shipmentTracking.create({ data: { shipmentId: id, status: nextStatus } }),
    ]);

    if (nextStatus === ShipmentStatus.SEARCHING_DRIVER) {
      this.eventEmitter.emit(DOMAIN_EVENTS.SHIPMENT_SEARCH_OPENED, new ShipmentSearchOpenedEvent(id));
    }
  }

  // -----------------------------------------------------------------------
  // Côté chauffeur : voir et accepter
  // -----------------------------------------------------------------------

  /**
   * Tout chauffeur dont le compte est validé (documents acceptés par
   * l'admin, voir DriverProfilesService.verify) peut voir et accepter des
   * envois, qu'il ait ou non un trajet établi. Renvoie l'id du profil.
   */
  async requireEligibleDriver(userId: string): Promise<string> {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { userId },
      select: { id: true, status: true },
    });
    if (!driver) throw new ForbiddenException('Cette action est réservée aux chauffeurs.');
    if (driver.status !== DriverAccountStatus.VALIDATED) {
      throw new ForbiddenException(
        'Votre compte doit être validé (documents acceptés) pour voir et accepter des envois.',
      );
    }
    return driver.id;
  }

  /** Envois en recherche de chauffeur dont la plage n'est pas terminée, filtrables par ville — vue sans données personnelles. */
  async findAvailable(dto: SearchAvailableShipmentsDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ShipmentWhereInput = {
      status: ShipmentStatus.SEARCHING_DRIVER,
      windowEnd: { gte: new Date() },
      ...(dto.originCityId ? { senderLocation: { cityId: dto.originCityId } } : {}),
      ...(dto.destinationCityId ? { recipientLocation: { cityId: dto.destinationCityId } } : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.shipment.findMany({
        where,
        skip: dto.skip,
        take: dto.take,
        orderBy: { createdAt: 'asc' },
        include: {
          category: true,
          currency: true,
          senderLocation: { include: { city: true } },
          recipientLocation: { include: { city: true } },
        },
      }),
      this.prisma.shipment.count({ where }),
    ]);
    return new PaginatedResult(data.map(toAvailableShipmentView), total, dto.page, dto.limit);
  }

  /**
   * Un chauffeur accepte un envoi en recherche (section 12 : ACCEPTER /
   * REFUSER) — avec un de ses trajets publiés (`tripId`) ou sans trajet.
   * "Le premier qui accepte l'emporte" : l'attribution est une mise à jour
   * conditionnelle unique (statut encore SEARCHING_DRIVER), donc deux
   * chauffeurs simultanés ne peuvent jamais tous les deux réussir — le
   * second reçoit une ConflictException.
   *
   * Le paiement est nécessairement déjà capturé à ce stade : un envoi
   * n'atteint SEARCHING_DRIVER qu'après confirmation de paiement (voir
   * confirmPayment) — le provisionnement du portefeuille chauffeur peut
   * donc se faire ici sans re-vérification.
   */
  async accept(shipmentId: string, userId: string, tripId?: string) {
    const driverId = await this.requireEligibleDriver(userId);

    const shipment = await this.findOne(shipmentId);
    if (shipment.status !== ShipmentStatus.SEARCHING_DRIVER) {
      throw new ConflictException("Cet envoi n'est plus disponible : un autre chauffeur l'a déjà accepté.");
    }
    const now = new Date();
    if (shipment.windowEnd < now) {
      throw new BadRequestException('La période choisie par le client pour cet envoi est terminée.');
    }

    let trip: Trip | null = null;
    if (tripId) {
      trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
      if (!trip) throw new NotFoundException('Trajet introuvable.');
      if (trip.driverId !== driverId) {
        throw new ForbiddenException("Ce trajet n'appartient pas à ce chauffeur.");
      }
      if (trip.status !== TripStatus.PUBLISHED || !trip.allowsShipments) {
        throw new BadRequestException("Ce trajet n'accepte pas d'envois pour le moment.");
      }
      if (trip.departureAt < shipment.windowStart || trip.departureAt > shipment.windowEnd) {
        throw new BadRequestException(
          'Le départ de ce trajet est en dehors de la plage de dates choisie par le client.',
        );
      }
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.shipment.updateMany({
        where: { id: shipmentId, status: ShipmentStatus.SEARCHING_DRIVER, windowEnd: { gte: now } },
        data: { status: ShipmentStatus.DRIVER_ASSIGNED, driverId, tripId: trip?.id ?? null },
      });
      if (claimed.count === 0) {
        throw new ConflictException("Cet envoi vient d'être accepté par un autre chauffeur.");
      }

      if (trip && trip.availableShipmentWeightKg !== null) {
        const capacityUpdate = await tx.trip.updateMany({
          where: {
            id: trip.id,
            status: TripStatus.PUBLISHED,
            availableShipmentWeightKg: { gte: shipment.weightKg },
          },
          data: { availableShipmentWeightKg: { decrement: shipment.weightKg } },
        });
        if (capacityUpdate.count === 0) {
          throw new ConflictException('Plus assez de capacité de transport sur ce trajet.');
        }
      }

      await tx.shipmentTracking.create({
        data: { shipmentId, status: ShipmentStatus.DRIVER_ASSIGNED },
      });

      return tx.shipment.findUniqueOrThrow({ where: { id: shipmentId } });
    });

    // Le client a payé un montant unique (totalAmount) ; la commission en est
    // déduite du gain du chauffeur : ex. 150 000 payés, 10 % de commission,
    // 135 000 crédités à la livraison.
    await this.wallets.holdShipmentRevenue({
      driverId,
      shipmentId,
      grossAmount: shipment.totalAmount,
      commission: shipment.platformFee,
      // Devise dans laquelle le client a payé (Shipment.currencyId) — peut
      // différer de la devise du wallet du chauffeur ; conversion faite
      // dans WalletsService.holdShipmentRevenue.
      sourceCurrencyId: shipment.currencyId,
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
        pushData: { type: 'DRIVER_ACCEPTED', shipmentId },
      });
    }

    return updated;
  }

  // -----------------------------------------------------------------------
  // Fin de plage : prolongation, expiration
  // -----------------------------------------------------------------------

  /**
   * Le client prolonge sa demande (nouvelle fin de plage) : l'envoi
   * redevient visible des chauffeurs et ils sont prévenus de nouveau.
   */
  async extendWindow(id: string, customerId: string, windowEnd: string) {
    const shipment = await this.findOne(id);
    if (shipment.customerId !== customerId) {
      throw new ForbiddenException("Cet envoi n'appartient pas à ce client.");
    }
    if (shipment.status !== ShipmentStatus.SEARCHING_DRIVER) {
      throw new BadRequestException('Seul un envoi en recherche de chauffeur peut être prolongé.');
    }

    const end = new Date(windowEnd);
    if (Number.isNaN(end.getTime()) || end <= new Date()) {
      throw new BadRequestException('La nouvelle fin de plage doit être dans le futur.');
    }

    const updated = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const result = await tx.shipment.update({
        where: { id },
        data: { windowEnd: end, extensionRequestedAt: null },
      });
      await tx.shipmentTracking.create({
        data: {
          shipmentId: id,
          status: ShipmentStatus.SEARCHING_DRIVER,
          note: `Plage prolongée jusqu'au ${end.toISOString()}`,
        },
      });
      return result;
    });

    this.eventEmitter.emit(DOMAIN_EVENTS.SHIPMENT_SEARCH_OPENED, new ShipmentSearchOpenedEvent(id));
    return updated;
  }

  /**
   * Le client n'a pas prolongé après la fin de plage : l'envoi est annulé
   * et son paiement intégralement remboursé. Attribution conditionnelle :
   * si un chauffeur a accepté entre-temps, rien n'est annulé. Renvoie
   * `true` si l'envoi a bien été expiré.
   */
  async expireSearch(id: string, reason: string): Promise<boolean> {
    const expired = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const claimed = await tx.shipment.updateMany({
        where: { id, status: ShipmentStatus.SEARCHING_DRIVER, extensionRequestedAt: { not: null } },
        data: {
          status: ShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationInitiator.SYSTEM,
          cancellationReason: reason,
        },
      });
      if (claimed.count === 0) return false;
      await tx.shipmentTracking.create({
        data: { shipmentId: id, status: ShipmentStatus.CANCELLED, note: reason },
      });
      return true;
    });

    if (expired) {
      this.eventEmitter.emit(
        DOMAIN_EVENTS.SHIPMENT_CANCELLED,
        new ShipmentCancelledEvent(id, reason, FULL_REFUND_PERCENTAGE),
      );
    }
    return expired;
  }

  /**
   * Un envoi créé mais jamais payé libère la capacité de trajet qu'il
   * réservait à la création. Sans effet si le paiement est arrivé entre-temps
   * (statut plus CREATED).
   */
  async expireUnpaid(id: string, reason: string): Promise<boolean> {
    const expired = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const shipment = await tx.shipment.findUnique({ where: { id } });
      if (!shipment) return false;

      const claimed = await tx.shipment.updateMany({
        where: { id, status: ShipmentStatus.CREATED },
        data: {
          status: ShipmentStatus.CANCELLED,
          cancelledAt: new Date(),
          cancelledBy: CancellationInitiator.SYSTEM,
          cancellationReason: reason,
        },
      });
      if (claimed.count === 0) return false;

      if (shipment.tripId) {
        const trip = await tx.trip.findUnique({ where: { id: shipment.tripId } });
        if (trip && trip.availableShipmentWeightKg !== null) {
          await tx.trip.update({
            where: { id: shipment.tripId },
            data: { availableShipmentWeightKg: { increment: shipment.weightKg } },
          });
        }
      }

      await tx.shipmentTracking.create({
        data: { shipmentId: id, status: ShipmentStatus.CANCELLED, note: reason },
      });
      return true;
    });

    // Aucun paiement capturé : le remboursement est sans effet, mais
    // l'événement couvre le cas d'un paiement capturé juste avant.
    if (expired) {
      this.eventEmitter.emit(
        DOMAIN_EVENTS.SHIPMENT_CANCELLED,
        new ShipmentCancelledEvent(id, reason, FULL_REFUND_PERCENTAGE),
      );
    }
    return expired;
  }

  // -----------------------------------------------------------------------
  // Annulation
  // -----------------------------------------------------------------------

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
    if (requester?.driverId && shipment.driverId !== requester.driverId) {
      throw new ForbiddenException("Cet envoi n'est pas assigné à ce chauffeur.");
    }
    if (
      shipment.status === ShipmentStatus.CANCELLED ||
      shipment.status === ShipmentStatus.COMPLETED ||
      shipment.status === ShipmentStatus.DELIVERED
    ) {
      throw new BadRequestException('Cet envoi ne peut plus être annulé.');
    }
    if (
      (cancelledBy === CancellationInitiator.CUSTOMER || cancelledBy === CancellationInitiator.DRIVER) &&
      !CANCELLABLE_BY_PARTIES.includes(shipment.status)
    ) {
      throw new BadRequestException(
        "Le colis a déjà été récupéré : l'annulation n'est plus possible. Utilisez « Signaler un problème ».",
      );
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

    // Toute annulation restitue 100 % du montant payé par le client (règle
    // produit) — l'ancienne politique d'annulation par délai ne s'applique
    // plus aux envois.
    this.eventEmitter.emit(
      DOMAIN_EVENTS.SHIPMENT_CANCELLED,
      new ShipmentCancelledEvent(id, reason, FULL_REFUND_PERCENTAGE),
    );

    return { ...updated, refundEligiblePercentage: FULL_REFUND_PERCENTAGE };
  }

  // -----------------------------------------------------------------------
  // Listes
  // -----------------------------------------------------------------------

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

  /** Envois attribués à ce chauffeur (avec ou sans trajet). */
  async findAllForDriverTrips(driverId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const where: Prisma.ShipmentWhereInput = { OR: [{ driverId }, { trip: { driverId } }] };
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