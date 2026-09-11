// backend/src/dashboards/support-dashboard.service.ts
import { Injectable } from '@nestjs/common';
import { DisputePriority, DisputeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const ACTIVE_DISPUTE_STATUSES: DisputeStatus[] = [
  DisputeStatus.OPENED,
  DisputeStatus.UNDER_REVIEW,
  DisputeStatus.WAITING_FOR_CUSTOMER,
  DisputeStatus.WAITING_FOR_DRIVER,
  DisputeStatus.INVESTIGATION,
];

/** Section 48. */
@Injectable()
export class SupportDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [newDisputes, urgentDisputes, pendingDisputes, flaggedDrivers, flaggedCustomers] = await Promise.all([
      this.prisma.dispute.findMany({
        where: { status: DisputeStatus.OPENED },
        orderBy: { createdAt: 'asc' },
        include: { openedBy: true },
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
}
