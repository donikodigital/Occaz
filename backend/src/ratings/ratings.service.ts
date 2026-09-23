// backend/src/ratings/ratings.service.ts
// [22/09/2026] v3 — findGivenByUser() : « Mes avis », les notations données par l'utilisateur (et non reçues).
// [21/09/2026] v2 — note d'un envoi via Shipment.driverId.
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BookingStatus, RatingRole, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { PaginatedResult } from '../common/dto/pagination-response.dto';
import { CreateRatingDto } from './dto/create-rating.dto';

/**
 * Section 24 : notation mutuelle après chaque prestation. Le sens de la
 * notation (qui note qui) est déduit de l'identité de l'appelant par
 * rapport à la réservation/l'envoi — jamais fourni par le client, pour
 * empêcher un chauffeur de se faire passer pour le client ou inversement.
 */
@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  async rateForBooking(raterUserId: string, bookingId: string, dto: CreateRatingDto) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: { include: { user: true } },
        trip: { include: { driver: { include: { user: true } } } },
      },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('Seule une réservation terminée peut être notée.');
    }

    const { role, fromUserId, toUserId } = this.resolveDirection(
      raterUserId,
      booking.customer.user.id,
      booking.trip.driver.user.id,
    );

    await this.assertNotAlreadyRated(fromUserId, { bookingId });

    const rating = await this.prisma.rating.create({
      data: {
        role,
        fromUserId,
        toUserId,
        bookingId,
        score: dto.score,
        review: this.hasReviewDetails(dto)
          ? {
              create: {
                comment: dto.comment,
                punctuality: dto.punctuality,
                respect: dto.respect,
                communication: dto.communication,
                reliability: dto.reliability,
                vehicleCondition: dto.vehicleCondition,
              },
            }
          : undefined,
      },
      include: { review: true },
    });

    if (role === RatingRole.CUSTOMER_TO_DRIVER) {
      await this.refreshDriverRatingCache(booking.trip.driverId);
    }

    return rating;
  }

  async rateForShipment(raterUserId: string, shipmentId: string, dto: CreateRatingDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        customer: { include: { user: true } },
        driver: { include: { user: true } },
      },
    });
    if (!shipment) throw new NotFoundException('Envoi introuvable.');
    if (shipment.status !== ShipmentStatus.COMPLETED) {
      throw new BadRequestException('Seul un envoi terminé peut être noté.');
    }
    if (!shipment.driver) {
      throw new BadRequestException('Aucun chauffeur associé à cet envoi.');
    }

    const { role, fromUserId, toUserId } = this.resolveDirection(
      raterUserId,
      shipment.customer.user.id,
      shipment.driver.user.id,
    );

    await this.assertNotAlreadyRated(fromUserId, { shipmentId });

    const rating = await this.prisma.rating.create({
      data: {
        role,
        fromUserId,
        toUserId,
        shipmentId,
        score: dto.score,
        review: this.hasReviewDetails(dto)
          ? {
              create: {
                comment: dto.comment,
                punctuality: dto.punctuality,
                respect: dto.respect,
                communication: dto.communication,
                reliability: dto.reliability,
                vehicleCondition: dto.vehicleCondition,
              },
            }
          : undefined,
      },
      include: { review: true },
    });

    if (role === RatingRole.CUSTOMER_TO_DRIVER) {
      await this.refreshDriverRatingCache(shipment.driver.id);
    }

    return rating;
  }

  findForUser(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    return this.paginateRatings({ toUserId: userId }, query);
  }

  /**
   * "Mes avis" (écran client) : les notations que CET utilisateur a
   * données, pas celles qu'il a reçues (findForUser ci-dessus). `toUser`
   * n'est jamais renvoyé en entier — seuls prénom/nom/photo, jamais le
   * téléphone ni les coordonnées de paiement du chauffeur noté.
   */
  async findGivenByUser(userId: string, query: PaginationQueryDto): Promise<PaginatedResult<unknown>> {
    const [data, total] = await Promise.all([
      this.prisma.rating.findMany({
        where: { fromUserId: userId },
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: {
          review: true,
          toUser: {
            select: {
              driverProfile: { select: { firstName: true, lastName: true, photoUrl: true } },
              customerProfile: { select: { firstName: true, lastName: true, photoUrl: true } },
            },
          },
          booking: {
            select: {
              trip: { select: { departureAt: true, originCity: { select: { name: true } }, destinationCity: { select: { name: true } } } },
            },
          },
          shipment: {
            select: {
              createdAt: true,
              senderLocation: { select: { city: { select: { name: true } } } },
              recipientLocation: { select: { city: { select: { name: true } } } },
            },
          },
        },
      }),
      this.prisma.rating.count({ where: { fromUserId: userId } }),
    ]);

    return new PaginatedResult(data.map((rating) => this.toGivenRatingView(rating)), total, query.page, query.limit);
  }

  private toGivenRatingView(rating: {
    id: string;
    score: number;
    createdAt: Date;
    review: { comment: string | null } | null;
    toUser: {
      driverProfile: { firstName: string; lastName: string; photoUrl: string | null } | null;
      customerProfile: { firstName: string; lastName: string; photoUrl: string | null } | null;
    };
    booking: {
      trip: { departureAt: Date; originCity: { name: string }; destinationCity: { name: string } };
    } | null;
    shipment: {
      createdAt: Date;
      senderLocation: { city: { name: string } | null };
      recipientLocation: { city: { name: string } | null };
    } | null;
  }) {
    const target = rating.toUser.driverProfile ?? rating.toUser.customerProfile;
    const context = rating.booking
      ? {
          type: 'trip' as const,
          route: `${rating.booking.trip.originCity.name} → ${rating.booking.trip.destinationCity.name}`,
          date: rating.booking.trip.departureAt,
        }
      : rating.shipment
        ? {
            type: 'shipment' as const,
            route: `${rating.shipment.senderLocation.city?.name ?? '—'} → ${rating.shipment.recipientLocation.city?.name ?? '—'}`,
            date: rating.shipment.createdAt,
          }
        : null;

    return {
      id: rating.id,
      score: rating.score,
      comment: rating.review?.comment ?? null,
      createdAt: rating.createdAt,
      targetName: target ? `${target.firstName} ${target.lastName}` : 'Utilisateur supprimé',
      targetPhotoUrl: target?.photoUrl ?? null,
      context,
    };
  }

  findForBooking(bookingId: string) {
    return this.prisma.rating.findMany({ where: { bookingId }, include: { review: true } });
  }

  findForShipment(shipmentId: string) {
    return this.prisma.rating.findMany({ where: { shipmentId }, include: { review: true } });
  }

  private async paginateRatings(
    where: { toUserId: string },
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<unknown>> {
    const [data, total] = await Promise.all([
      this.prisma.rating.findMany({
        where,
        skip: query.skip,
        take: query.take,
        orderBy: { createdAt: 'desc' },
        include: { review: true },
      }),
      this.prisma.rating.count({ where }),
    ]);
    return new PaginatedResult(data, total, query.page, query.limit);
  }

  private resolveDirection(
    raterUserId: string,
    customerUserId: string,
    driverUserId: string,
  ): { role: RatingRole; fromUserId: string; toUserId: string } {
    if (raterUserId === customerUserId) {
      return { role: RatingRole.CUSTOMER_TO_DRIVER, fromUserId: customerUserId, toUserId: driverUserId };
    }
    if (raterUserId === driverUserId) {
      return { role: RatingRole.DRIVER_TO_CUSTOMER, fromUserId: driverUserId, toUserId: customerUserId };
    }
    throw new ForbiddenException("Vous n'êtes ni le client ni le chauffeur de cette prestation.");
  }

  private async assertNotAlreadyRated(
    fromUserId: string,
    scope: { bookingId?: string; shipmentId?: string },
  ): Promise<void> {
    const existing = await this.prisma.rating.findFirst({ where: { fromUserId, ...scope } });
    if (existing) {
      throw new ConflictException('Cette prestation a déjà été notée.');
    }
  }

  private hasReviewDetails(dto: CreateRatingDto): boolean {
    return Boolean(
      dto.comment ||
        dto.punctuality ||
        dto.respect ||
        dto.communication ||
        dto.reliability ||
        dto.vehicleCondition,
    );
  }

  /** Recalcule le cache de note moyenne du chauffeur (section 25). */
  private async refreshDriverRatingCache(driverId: string): Promise<void> {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      select: { userId: true },
    });
    if (!driver) return;

    const aggregate = await this.prisma.rating.aggregate({
      where: { toUserId: driver.userId, role: RatingRole.CUSTOMER_TO_DRIVER },
      _avg: { score: true },
      _count: { score: true },
    });

    await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: {
        averageRating: aggregate._avg.score ?? undefined,
        ratingsCount: aggregate._count.score,
      },
    });
  }
}