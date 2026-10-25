// backend/src/devices/devices.service.spec.ts
// Un token push = un téléphone = une seule ligne : rouvrir l'application ne crée plus de ligne, donc plus de notification en double.
import { Prisma } from '@prisma/client';
import { DevicesService } from './devices.service';

const TOKEN = 'ExponentPushToken[abc]';

/** Base simulée : une table de lignes « appareil » avec l'unicité du token, comme l'index unique de PostgreSQL. */
function build(initial: Array<{ id: string; userId: string; platform: string; pushToken: string | null }> = []) {
  const rows = initial.map((row) => ({ ...row, isTrusted: false, lastSeenAt: null as Date | null }));
  let nextId = rows.length + 1;
  const prisma = {
    device: {
      updateMany: jest.fn().mockImplementation(({ where, data }: { where: { pushToken: string; userId: { not: string } }; data: { pushToken: null } }) => {
        const hit = rows.filter((row) => row.pushToken === where.pushToken && row.userId !== where.userId.not);
        hit.forEach((row) => Object.assign(row, data));
        return Promise.resolve({ count: hit.length });
      }),
      findUnique: jest.fn().mockImplementation(({ where }: { where: { id?: string; pushToken?: string } }) =>
        Promise.resolve(rows.find((row) => (where.id ? row.id === where.id : row.pushToken === where.pushToken)) ?? null),
      ),
      update: jest.fn().mockImplementation(({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = rows.find((candidate) => candidate.id === where.id)!;
        Object.assign(row, data);
        return Promise.resolve({ ...row });
      }),
      create: jest.fn().mockImplementation(({ data }: { data: { userId: string; platform: string; pushToken?: string } }) => {
        if (data.pushToken && rows.some((row) => row.pushToken === data.pushToken)) {
          return Promise.reject(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }));
        }
        const row = { id: `d${nextId++}`, isTrusted: false, lastSeenAt: null as Date | null, pushToken: null as string | null, ...data };
        rows.push(row as (typeof rows)[number]);
        return Promise.resolve({ ...row });
      }),
    },
  };
  return { service: new DevicesService(prisma as never), prisma, rows };
}

describe('DevicesService — un token push, une seule ligne', () => {
  it('enregistrer le même token 3 fois (3 ouvertures de l\'app) ne crée qu\'une seule ligne', async () => {
    const { service, rows } = build();
    await service.register('u1', { platform: 'android', pushToken: TOKEN });
    await service.register('u1', { platform: 'android', pushToken: TOKEN });
    await service.register('u1', { platform: 'android', pushToken: TOKEN });
    expect(rows.filter((row) => row.pushToken === TOKEN)).toHaveLength(1);
  });

  it('un token déjà connu met à jour la ligne existante (vu récemment) au lieu d\'en créer une', async () => {
    const { service, prisma, rows } = build([{ id: 'd1', userId: 'u1', platform: 'android', pushToken: TOKEN }]);
    await service.register('u1', { platform: 'android', pushToken: TOKEN });
    expect(prisma.device.create).not.toHaveBeenCalled();
    expect(rows[0].lastSeenAt).toBeInstanceOf(Date);
  });

  it('le même téléphone utilisé par un autre compte : le token est retiré à l\'ancien compte', async () => {
    const { service, rows } = build([{ id: 'd1', userId: 'ancien', platform: 'android', pushToken: TOKEN }]);
    await service.register('nouveau', { platform: 'android', pushToken: TOKEN });
    expect(rows.find((row) => row.userId === 'ancien')!.pushToken).toBeNull();
    expect(rows.filter((row) => row.pushToken === TOKEN).map((row) => row.userId)).toEqual(['nouveau']);
  });

  it('la connexion réutilise la ligne du token et la marque de confiance', async () => {
    const { service, rows } = build([{ id: 'd1', userId: 'u1', platform: 'android', pushToken: TOKEN }]);
    await service.findOrCreateForLogin('u1', { platform: 'android', pushToken: TOKEN });
    expect(rows).toHaveLength(1);
    expect(rows[0].isTrusted).toBe(true);
  });

  it('deux demandes simultanées pour un token neuf : l\'index unique en laisse passer une, l\'autre met à jour', async () => {
    const { service, rows } = build();
    await Promise.all([
      service.register('u1', { platform: 'android', pushToken: TOKEN }),
      service.register('u1', { platform: 'android', pushToken: TOKEN }),
    ]);
    expect(rows.filter((row) => row.pushToken === TOKEN)).toHaveLength(1);
  });

  it('sans token (web) : une ligne est créée, sans toucher aux autres', async () => {
    const { service, prisma, rows } = build();
    await service.register('u1', { platform: 'web' });
    expect(prisma.device.updateMany).not.toHaveBeenCalled();
    expect(rows).toHaveLength(1);
  });
});
