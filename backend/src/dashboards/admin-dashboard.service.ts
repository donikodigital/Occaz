// backend/src/dashboards/admin-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import {
  AccountType,
  BookingStatus,
  DisputeStatus,
  DriverAccountStatus,
  PaymentStatus,
  ShipmentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_WINDOW_DAYS = 30;

/**
 * Section 45. Chaque chiffre vient d'une vraie requête d'agrégation, pas
 * d'une valeur simulée — un tableau de bord qui affiche des données
 * fausses serait pire qu'inutile pour un SuperAdmin. Les graphiques
 * quotidien/hebdo/mensuel/annuel (section 45) sont couverts par
 * `getRevenueTimeSeries`, seule requête nécessitant du SQL brut
 * (regroupement par période, non exprimable proprement en Prisma pur).
 */
@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const activeSince = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

    const [
      usersCount,
      driversCount,
      verifiedDriversCount,
      customersCount,
      activeDriversCount,
      activeCustomersCount,
      tripsCount,
      bookingsCount,
      completedBookingsCount,
      shipmentsCount,
      completedShipmentsCount,
      disputesCount,
      openDisputesCount,
      resolvedDisputesCount,
      bookingRevenue,
      shipmentRevenue,
      refundedTransactions,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.driverProfile.count(),
      this.prisma.driverProfile.count({ where: { status: DriverAccountStatus.VALIDATED } }),
      this.prisma.customerProfile.count(),
      this.prisma.user.count({
        where: { accountType: AccountType.DRIVER, lastLoginAt: { gte: activeSince } },
      }),
      this.prisma.user.count({
        where: { accountType: AccountType.CUSTOMER, lastLoginAt: { gte: activeSince } },
      }),
      this.prisma.trip.count(),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { status: BookingStatus.COMPLETED } }),
      this.prisma.shipment.count(),
      this.prisma.shipment.count({ where: { status: ShipmentStatus.COMPLETED } }),
      this.prisma.dispute.count(),
      this.prisma.dispute.count({ where: { status: DisputeStatus.OPENED } }),
      this.prisma.dispute.count({
        where: { status: { in: [DisputeStatus.RESOLVED, DisputeStatus.CLOSED] } },
      }),
      this.prisma.booking.aggregate({
        where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
        _sum: { totalAmount: true, platformFee: true },
      }),
      this.prisma.shipment.aggregate({
        where: { status: { notIn: [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED] } },
        _sum: { totalAmount: true, platformFee: true },
      }),
      this.prisma.paymentTransaction.aggregate({
        where: { status: PaymentStatus.REFUNDED },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const resolutionRate = disputesCount === 0 ? null : Math.round((resolvedDisputesCount / disputesCount) * 100);

    return {
      users: { total: usersCount, drivers: driversCount, verifiedDrivers: verifiedDriversCount, customers: customersCount },
      active: { drivers: activeDriversCount, customers: activeCustomersCount, windowDays: ACTIVE_WINDOW_DAYS },
      trips: { total: tripsCount, bookings: bookingsCount, completedBookings: completedBookingsCount },
      shipments: { total: shipmentsCount, completed: completedShipmentsCount },
      disputes: { total: disputesCount, open: openDisputesCount, resolutionRatePercent: resolutionRate },
      finance: {
        grossBookingRevenue: bookingRevenue._sum.totalAmount ?? 0n,
        bookingCommission: bookingRevenue._sum.platformFee ?? 0n,
        grossShipmentRevenue: shipmentRevenue._sum.totalAmount ?? 0n,
        shipmentCommission: shipmentRevenue._sum.platformFee ?? 0n,
        refundedAmount: refundedTransactions._sum.amount ?? 0n,
        refundedCount: refundedTransactions._count,
      },
    };
  }

  /** Section 45 : "volume par pays" — nombre de trajets par pays d'origine. */
  async getVolumeByCountry() {
    const rows = await this.prisma.$queryRaw<{ countryName: string; tripCount: bigint }[]>`
      SELECT c.name AS "countryName", COUNT(t.id) AS "tripCount"
      FROM trips t
      JOIN cities ci ON ci.id = t."originCityId"
      JOIN countries c ON c.id = ci."countryId"
      GROUP BY c.name
      ORDER BY "tripCount" DESC;
    `;
    return rows.map((r) => ({ countryName: r.countryName, tripCount: Number(r.tripCount) }));
  }

  /** Section 45 : "volume GNF / volume XOF" — montant total transigé par devise. */
  async getVolumeByCurrency() {
    const [bookingsByCurrency, shipmentsByCurrency] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['currencyId'],
        where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
        _sum: { totalAmount: true },
      }),
      this.prisma.shipment.groupBy({
        by: ['currencyId'],
        where: { status: { notIn: [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED] } },
        _sum: { totalAmount: true },
      }),
    ]);

    const currencies = await this.prisma.currency.findMany();
    const isoByCurrencyId = new Map(currencies.map((c) => [c.id, c.isoCode]));

    return { bookingsByCurrency, shipmentsByCurrency, isoByCurrencyId: Object.fromEntries(isoByCurrencyId) };
  }

  /**
   * Graphiques quotidien/hebdo/mensuel/annuel (section 45) — revenu de
   * commission regroupé par période via `date_trunc`, seule façon
   * propre d'obtenir un histogramme temporel en SQL.
   */
  async getRevenueTimeSeries(granularity: 'day' | 'week' | 'month' | 'year', fromDate: Date, toDate: Date) {
    // `granularity` n'est jamais interpolée directement dans le SQL brut
    // (elle vient d'un enum contrôlé côté DTO, jamais du texte libre de
    // l'appelant) — évite toute injection tout en gardant date_trunc dynamique.
    const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[granularity];

    const rows = await this.prisma.$queryRawUnsafe<{ bucket: Date; commission: bigint | null }[]>(
      `
      SELECT date_trunc('${unit}', "createdAt") AS bucket, SUM("platformFee") AS commission
      FROM bookings
      WHERE "createdAt" BETWEEN $1 AND $2
        AND status IN ('CONFIRMED', 'COMPLETED')
      GROUP BY bucket
      ORDER BY bucket ASC;
      `,
      fromDate,
      toDate,
    );

    return rows.map((r) => ({ period: r.bucket, commission: r.commission?.toString() ?? '0' }));
  }
}
