// backend/src/dashboards/customer-dashboard.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingStatus, DisputeStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Section 47. "Favoris" n'est volontairement pas couvert : aucun modèle
 * du schéma ne porte cette fonctionnalité (elle n'apparaît pas non plus
 * dans le MVP du cahier des charges, Partie XIV) — l'ajouter
 * maintenant aurait exigé une nouvelle table sans besoin fonctionnel
 * confirmé. Signalé ici explicitement plutôt que silencieusement omis.
 */
@Injectable()
export class CustomerDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(customerId: string) {
    const customer = await this.prisma.customerProfile.findUnique({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Profil client introuvable.');

    const [nextBooking, activeBookingsCount, activeShipmentsCount, openDisputesCount, recentPayments] =
      await Promise.all([
        this.prisma.booking.findFirst({
          where: {
            customerId,
            status: { in: [BookingStatus.CONFIRMED, BookingStatus.PAID] },
            trip: { departureAt: { gte: new Date() } },
          },
          orderBy: { trip: { departureAt: 'asc' } },
          include: { trip: { include: { originCity: true, destinationCity: true, driver: true } } },
        }),
        this.prisma.booking.count({
          where: {
            customerId,
            status: { in: [BookingStatus.PENDING_PAYMENT, BookingStatus.PAID, BookingStatus.CONFIRMED] },
          },
        }),
        this.prisma.shipment.count({
          where: {
            customerId,
            status: {
              notIn: [ShipmentStatus.CANCELLED, ShipmentStatus.COMPLETED, ShipmentStatus.REFUNDED],
            },
          },
        }),
        this.prisma.dispute.count({
          where: {
            status: { notIn: [DisputeStatus.RESOLVED, DisputeStatus.CLOSED] },
            OR: [{ booking: { customerId } }, { shipment: { customerId } }],
          },
        }),
        this.prisma.payment.findMany({
          where: { OR: [{ booking: { customerId } }, { shipment: { customerId } }] },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      ]);

    return {
      nextBooking,
      activeBookingsCount,
      activeShipmentsCount,
      openDisputesCount,
      recentPayments,
    };
  }
}
