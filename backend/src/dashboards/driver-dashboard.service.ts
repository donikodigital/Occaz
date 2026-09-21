// backend/src/dashboards/driver-dashboard.service.ts
// [21/09/2026] v2 — compteurs d'envois via Shipment.driverId.
import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, ShipmentStatus, TripStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Section 46 — vue de synthèse ; l'historique complet reste sur GET /trips/mine et GET /shipments/assigned-to-me. */
@Injectable()
export class DriverDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({
      where: { id: driverId },
      include: { wallet: true },
    });
    if (!driver) throw new NotFoundException('Profil chauffeur introuvable.');

    const [nextTrip, reservedSeatsAgg, shipmentsToPickup, shipmentsInProgress] = await Promise.all([
      this.prisma.trip.findFirst({
        where: {
          driverId,
          status: { in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED, TripStatus.PASSENGER_PICKED_UP] },
          departureAt: { gte: new Date() },
        },
        orderBy: { departureAt: 'asc' },
        include: { originCity: true, destinationCity: true },
      }),
      this.prisma.booking.aggregate({
        where: {
          trip: { driverId, status: { in: [TripStatus.PUBLISHED, TripStatus.DRIVER_ARRIVED] } },
          status: BookingStatus.CONFIRMED,
        },
        _sum: { seatsCount: true },
      }),
      this.prisma.shipment.count({
        where: { driverId, status: { in: [ShipmentStatus.DRIVER_ASSIGNED, ShipmentStatus.PICKUP_PENDING] } },
      }),
      this.prisma.shipment.count({
        where: {
          driverId,
          status: { in: [ShipmentStatus.PICKED_UP, ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERY_PENDING] },
        },
      }),
    ]);

    return {
      nextTrip,
      reservedSeats: reservedSeatsAgg._sum.seatsCount ?? 0,
      shipmentsToPickup,
      shipmentsInProgress,
      wallet: driver.wallet
        ? { balance: driver.wallet.balance, pendingBalance: driver.wallet.pendingBalance }
        : null,
      rating: { average: driver.averageRating, count: driver.ratingsCount },
      stats: {
        completedTrips: driver.completedTripsCount,
        completedShipments: driver.completedShipmentsCount,
        cancellations: driver.cancellationCount,
      },
      status: driver.status,
      isVerifiedBadge: driver.isVerifiedBadge,
    };
  }
}