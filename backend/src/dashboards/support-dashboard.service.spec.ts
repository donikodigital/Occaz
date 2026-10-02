// backend/src/dashboards/support-dashboard.service.spec.ts
import { SupportDashboardService } from './support-dashboard.service';

const person = (id: string) => ({ id, firstName: `P${id}`, lastName: 'X' });

function build(activeDisputes: unknown[]) {
  const prisma = {
    dispute: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce([{ id: 'n1' }]) // nouveaux
        .mockResolvedValueOnce([{ id: 'u1' }]) // urgents
        .mockResolvedValueOnce(activeDisputes), // litiges actifs (agrégats)
    },
    $queryRaw: jest.fn(),
  };
  return { service: new SupportDashboardService(prisma as never), prisma };
}

describe('SupportDashboardService (portée par pays)', () => {
  it('n\'utilise jamais le SQL brut quand une portée est donnée, et filtre chaque requête par la portée', async () => {
    const { service, prisma } = build([]);
    await service.getOverview(['GN']);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    for (const call of prisma.dispute.findMany.mock.calls) {
      expect(JSON.stringify(call[0].where)).toContain('"in":["GN"]');
    }
  });

  it('compte les litiges actifs et classe chauffeurs et clients par nombre de litiges', async () => {
    const { service } = build([
      { id: 'd1', booking: { customer: person('c1'), trip: { driver: person('dr1') } }, shipment: null },
      { id: 'd2', booking: null, shipment: { customer: person('c1'), driver: person('dr1'), trip: null } },
      { id: 'd3', booking: null, shipment: { customer: person('c2'), driver: null, trip: { driver: person('dr2') } } },
    ]);
    const overview = await service.getOverview(['GN']);

    expect(overview.pendingDisputesCount).toBe(3);
    expect(overview.newDisputes).toHaveLength(1);
    expect(overview.urgentDisputes).toHaveLength(1);
    expect(overview.flaggedCustomers.map((c) => [c.customerId, c.disputeCount])).toEqual([
      ['c1', 2],
      ['c2', 1],
    ]);
    expect(overview.flaggedDrivers.map((d) => [d.driverId, d.disputeCount])).toEqual([
      ['dr1', 2],
      ['dr2', 1],
    ]);
  });

  it('sans portée : requêtes d\'origine (SQL brut pour les chauffeurs/clients concernés)', async () => {
    const prisma = {
      dispute: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
      $queryRaw: jest.fn().mockResolvedValue([]),
    };
    const service = new SupportDashboardService(prisma as never);
    await service.getOverview();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.dispute.count).toHaveBeenCalledTimes(1);
  });
});