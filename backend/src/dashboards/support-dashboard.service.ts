// backend/src/dashboards/support-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { DisputePriority, DisputeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { disputeScopeWhere } from '../common/scope/country-scope';

const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = [
  DisputeStatus.OPENED,
  DisputeStatus.UNDER_REVIEW,
  DisputeStatus.WAITING_FOR_CUSTOMER,
  DisputeStatus.WAITING_FOR_DRIVER,
  DisputeStatus.INVESTIGATION,
];

// [02/10/2026] v+ — openedBy ne renvoie plus que id / téléphone / email.
// [02/10/2026] v+ — getOverview(scope) : un agent limité à des pays ne voit que les litiges de son périmètre.
// Sans portée (SuperAdmin, rôle sans pays) le comportement et les requêtes sont strictement ceux d'avant.
/** Section 48. */
@Injectable()
export class SupportDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(scope: string[] | null = null) {
    if (scope) return this.getScopedOverview(scope);

    const [newDisputes, urgentDisputes, pendingDisputes, flaggedDrivers, flaggedCustomers] = await Promise.all([
      this.prisma.dispute.findMany({
        where: { status: DisputeStatus.OPENED },
        orderBy: { createdAt: 'asc' },
        // Uniquement ce que l'écran affiche : `include: true` renvoyait toute la ligne User (hash du mot de passe, secret 2FA…).
        include: { openedBy: { select: { id: true, phone: true, email: true } } },
      }),
      this.prisma.dispute.findMany({
        where: {
          status: { in: ACTIVE_DISPUTE_STATUSES },
          priority: { in: [DisputePriority.HIGH, DisputePriority.CRITICAL] },
        },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.dispute.count({ where: { status: { in: ACTIVE_DISPUTE_STATUSES } } }),
      this.prisma.$queryRaw<{ driverId: string; firstName: string; lastName: string; disputeCount: bigint }[]>`
        SELECT dp.id AS "driverId", dp."firstName", dp."lastName", COUNT(DISTINCT d.id) AS "disputeCount"
        FROM disputes d
        LEFT JOIN bookings b ON b.id = d."bookingId"
        LEFT JOIN trips t1 ON t1.id = b."tripId"
        LEFT JOIN shipments s ON s.id = d."shipmentId"
        LEFT JOIN trips t2 ON t2.id = s."tripId"
        JOIN driver_profiles dp ON dp.id = COALESCE(t1."driverId", t2."driverId")
        WHERE d.status IN ('OPENED', 'UNDER_REVIEW', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_DRIVER', 'INVESTIGATION')
        GROUP BY dp.id, dp."firstName", dp."lastName"
        ORDER BY "disputeCount" DESC;
      `,
      this.prisma.$queryRaw<{ customerId: string; firstName: string; lastName: string; disputeCount: bigint }[]>`
        SELECT cp.id AS "customerId", cp."firstName", cp."lastName", COUNT(DISTINCT d.id) AS "disputeCount"
        FROM disputes d
        LEFT JOIN bookings b ON b.id = d."bookingId"
        LEFT JOIN shipments s ON s.id = d."shipmentId"
        JOIN customer_profiles cp ON cp.id = COALESCE(b."customerId", s."customerId")
        WHERE d.status IN ('OPENED', 'UNDER_REVIEW', 'WAITING_FOR_CUSTOMER', 'WAITING_FOR_DRIVER', 'INVESTIGATION')
        GROUP BY cp.id, cp."firstName", cp."lastName"
        ORDER BY "disputeCount" DESC;
      `,
    ]);

    return {
      newDisputes,
      urgentDisputes,
      pendingDisputesCount: pendingDisputes,
      flaggedDrivers: flaggedDrivers.map((r) => ({ ...r, disputeCount: Number(r.disputeCount) })),
      flaggedCustomers: flaggedCustomers.map((r) => ({ ...r, disputeCount: Number(r.disputeCount) })),
    };
  }

  /**
   * Même contenu que getOverview(), calculé avec le client Prisma (et non en SQL brut) sur les seuls litiges
   * du périmètre : les agrégats « chauffeurs / clients les plus concernés » se font en mémoire sur ces litiges.
   */
  private async getScopedOverview(scope: string[]) {
    const inScope = disputeScopeWhere(scope);
    const activeWhere = { AND: [{ status: { in: ACTIVE_DISPUTE_STATUSES } }, inScope] };

    const [newDisputes, urgentDisputes, activeDisputes] = await Promise.all([
      this.prisma.dispute.findMany({
        where: { AND: [{ status: DisputeStatus.OPENED }, inScope] },
        orderBy: { createdAt: 'asc' },
        include: { openedBy: { select: { id: true, phone: true, email: true } } },
      }),
      this.prisma.dispute.findMany({
        where: { AND: [activeWhere, { priority: { in: [DisputePriority.HIGH, DisputePriority.CRITICAL] } }] },
        orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      }),
      this.prisma.dispute.findMany({
        where: activeWhere,
        select: {
          id: true,
          booking: {
            select: {
              customer: { select: { id: true, firstName: true, lastName: true } },
              trip: { select: { driver: { select: { id: true, firstName: true, lastName: true } } } },
            },
          },
          shipment: {
            select: {
              customer: { select: { id: true, firstName: true, lastName: true } },
              driver: { select: { id: true, firstName: true, lastName: true } },
              trip: { select: { driver: { select: { id: true, firstName: true, lastName: true } } } },
            },
          },
        },
      }),
    ]);

    type Person = { id: string; firstName: string; lastName: string };
    const driverCounts = new Map<string, { person: Person; count: number }>();
    const customerCounts = new Map<string, { person: Person; count: number }>();
    const bump = (map: Map<string, { person: Person; count: number }>, person: Person | null | undefined) => {
      if (!person) return;
      const entry = map.get(person.id) ?? { person, count: 0 };
      entry.count += 1;
      map.set(person.id, entry);
    };

    for (const dispute of activeDisputes) {
      bump(customerCounts, dispute.booking?.customer ?? dispute.shipment?.customer);
      bump(
        driverCounts,
        dispute.booking?.trip.driver ?? dispute.shipment?.driver ?? dispute.shipment?.trip?.driver,
      );
    }

    const byCountDesc = <T extends { disputeCount: number }>(a: T, b: T) => b.disputeCount - a.disputeCount;
    return {
      newDisputes,
      urgentDisputes,
      pendingDisputesCount: activeDisputes.length,
      flaggedDrivers: Array.from(driverCounts.values())
        .map(({ person, count }) => ({
          driverId: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          disputeCount: count,
        }))
        .sort(byCountDesc),
      flaggedCustomers: Array.from(customerCounts.values())
        .map(({ person, count }) => ({
          customerId: person.id,
          firstName: person.firstName,
          lastName: person.lastName,
          disputeCount: count,
        }))
        .sort(byCountDesc),
    };
  }
}