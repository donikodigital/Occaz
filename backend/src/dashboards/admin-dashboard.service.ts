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
      bookingRevenueByCurrency,
      shipmentRevenueByCurrency,
      refundedByCurrency,
      currencies,
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
      this.prisma.booking.groupBy({
        by: ['currencyId'],
        where: { status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] } },
        _sum: { totalAmount: true, platformFee: true },
      }),
      this.prisma.shipment.groupBy({
        by: ['currencyId'],
        where: { status: { notIn: [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED] } },
        _sum: { totalAmount: true, platformFee: true },
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['currencyId'],
        where: { status: PaymentStatus.REFUNDED },
        _sum: { amount: true },
        _count: true,
      }),
      this.prisma.currency.findMany(),
    ]);

    const resolutionRate = disputesCount === 0 ? null : Math.round((resolvedDisputesCount / disputesCount) * 100);

    // Jamais additionné entre devises différentes (1 GNF ≠ 1 XOF) — même
    // principe que CommissionSummaryService et ExchangeRateService.
    // Chaque devise active apparaît même à 0, pour que le XOF reste
    // visible dès qu'il existe, pas seulement une fois qu'il y a du volume.
    type GroupedRow = { currencyId: string; _sum: Record<string, bigint | null>; _count?: number };
    const bookingByCurrencyId = new Map((bookingRevenueByCurrency as GroupedRow[]).map((r) => [r.currencyId, r]));
    const shipmentByCurrencyId = new Map((shipmentRevenueByCurrency as GroupedRow[]).map((r) => [r.currencyId, r]));
    const refundByCurrencyId = new Map((refundedByCurrency as GroupedRow[]).map((r) => [r.currencyId, r]));

    const finance = currencies.map((currency) => {
      const booking = bookingByCurrencyId.get(currency.id);
      const shipment = shipmentByCurrencyId.get(currency.id);
      const refund = refundByCurrencyId.get(currency.id);
      return {
        currencyId: currency.id,
        isoCode: currency.isoCode,
        grossBookingRevenue: booking?._sum.totalAmount ?? 0n,
        bookingCommission: booking?._sum.platformFee ?? 0n,
        grossShipmentRevenue: shipment?._sum.totalAmount ?? 0n,
        shipmentCommission: shipment?._sum.platformFee ?? 0n,
        refundedAmount: refund?._sum.amount ?? 0n,
        refundedCount: refund?._count ?? 0,
      };
    });

    return {
      users: { total: usersCount, drivers: driversCount, verifiedDrivers: verifiedDriversCount, customers: customersCount },
      active: { drivers: activeDriversCount, customers: activeCustomersCount, windowDays: ACTIVE_WINDOW_DAYS },
      trips: { total: tripsCount, bookings: bookingsCount, completedBookings: completedBookingsCount },
      shipments: { total: shipmentsCount, completed: completedShipmentsCount },
      disputes: { total: disputesCount, open: openDisputesCount, resolutionRatePercent: resolutionRate },
      finance,
    };
  }

  /**
   * Trajets les plus demandés (section 45, "données les plus consultées")
   * — les 5 trajets villeOrigine → villeDestination avec le plus de
   * réservations effectives (payées), tous trajets confondus sur cette
   * paire de villes. Compte les réservations (la demande réelle), pas
   * les trajets publiés (l'offre) : deux chiffres différents, et c'est
   * la demande qui intéresse un SuperAdmin ici.
   */
  async getTopRoutes(limit = 5) {
    const rows = await this.prisma.$queryRaw<
      { originName: string; destinationName: string; bookingCount: bigint }[]
    >`
      SELECT oc.name AS "originName", dc.name AS "destinationName", COUNT(b.id) AS "bookingCount"
      FROM bookings b
      JOIN trips t ON t.id = b."tripId"
      JOIN cities oc ON oc.id = t."originCityId"
      JOIN cities dc ON dc.id = t."destinationCityId"
      WHERE b.status IN ('CONFIRMED', 'COMPLETED')
      GROUP BY oc.name, dc.name
      ORDER BY "bookingCount" DESC
      LIMIT ${limit};
    `;
    return rows.map((r) => ({
      originName: r.originName,
      destinationName: r.destinationName,
      bookingCount: Number(r.bookingCount),
    }));
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

  /**
   * Évolution des trajets et des envois créés, période par période — un
   * volume d'activité (combien de nouveaux trajets/envois), pas un
   * montant : deux requêtes `date_trunc` distinctes plutôt qu'une seule
   * avec UNION, pour garder chaque table indépendante et lisible.
   */
  async getActivityTimeSeries(granularity: 'day' | 'week' | 'month' | 'year', fromDate: Date, toDate: Date) {
    const unit = { day: 'day', week: 'week', month: 'month', year: 'year' }[granularity];

    const [tripRows, shipmentRows] = await Promise.all([
      this.prisma.$queryRawUnsafe<{ bucket: Date; count: bigint }[]>(
        `
        SELECT date_trunc('${unit}', "createdAt") AS bucket, COUNT(*) AS count
        FROM trips
        WHERE "createdAt" BETWEEN $1 AND $2
        GROUP BY bucket
        ORDER BY bucket ASC;
        `,
        fromDate,
        toDate,
      ),
      this.prisma.$queryRawUnsafe<{ bucket: Date; count: bigint }[]>(
        `
        SELECT date_trunc('${unit}', "createdAt") AS bucket, COUNT(*) AS count
        FROM shipments
        WHERE "createdAt" BETWEEN $1 AND $2
        GROUP BY bucket
        ORDER BY bucket ASC;
        `,
        fromDate,
        toDate,
      ),
    ]);

    // Fusionne les deux séries sur l'union de leurs périodes — l'une peut
    // avoir un point qui manque à l'autre (ex : des trajets cette
    // semaine, aucun envoi) ; jamais 0 par défaut silencieux ailleurs que
    // sur des périodes réellement vides des deux côtés.
    const tripsByBucket = new Map(tripRows.map((r) => [r.bucket.toISOString(), Number(r.count)]));
    const shipmentsByBucket = new Map(shipmentRows.map((r) => [r.bucket.toISOString(), Number(r.count)]));
    const allBuckets = Array.from(new Set([...tripsByBucket.keys(), ...shipmentsByBucket.keys()])).sort();

    return allBuckets.map((bucket) => ({
      period: bucket,
      tripsCount: tripsByBucket.get(bucket) ?? 0,
      shipmentsCount: shipmentsByBucket.get(bucket) ?? 0,
    }));
  }
}