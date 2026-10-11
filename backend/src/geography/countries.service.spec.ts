// backend/src/geography/countries.service.spec.ts
// Le pays présélectionné à l'inscription : un seul à la fois, jamais un pays désactivé.
import { BadRequestException } from '@nestjs/common';
import { CountriesService } from './countries.service';

function build(existing: Record<string, unknown> = { id: 'gn', isActive: true }) {
  const prisma = {
    country: {
      findUnique: jest.fn().mockResolvedValue(existing),
      update: jest.fn().mockImplementation(async ({ where, data }) => ({ id: where.id, ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: jest.fn().mockImplementation(async (operations: Promise<unknown>[]) => Promise.all(operations)),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  return { service: new CountriesService(prisma as never, audit as never), prisma };
}

describe('CountriesService — pays par défaut à l’inscription', () => {
  it('en choisir un retire l’ancien', async () => {
    const { service, prisma } = build();
    await service.update('gn', { isSignupDefault: true }, 'admin');
    expect(prisma.country.updateMany).toHaveBeenCalledWith({ where: { isSignupDefault: true, id: { not: 'gn' } }, data: { isSignupDefault: false } });
    expect(prisma.country.update).toHaveBeenLastCalledWith({ where: { id: 'gn' }, data: { isSignupDefault: true } });
  });

  it('le retirer ne touche pas aux autres pays', async () => {
    const { service, prisma } = build();
    await service.update('gn', { isSignupDefault: false }, 'admin');
    expect(prisma.country.updateMany).not.toHaveBeenCalled();
    expect(prisma.country.update).toHaveBeenLastCalledWith({ where: { id: 'gn' }, data: { isSignupDefault: false } });
  });

  it('un pays désactivé ne peut pas l’être', async () => {
    const { service } = build({ id: 'sn', isActive: false });
    await expect(service.update('sn', { isSignupDefault: true }, 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('désactiver un pays lui retire aussi cette qualité', async () => {
    const { service, prisma } = build();
    await service.deactivate('gn', 'admin');
    expect(prisma.country.update).toHaveBeenCalledWith({ where: { id: 'gn' }, data: { isActive: false, isSignupDefault: false } });
  });

  it('une modification ordinaire n’y touche pas', async () => {
    const { service, prisma } = build();
    await service.update('gn', { name: 'Guinée' }, 'admin');
    expect(prisma.country.updateMany).not.toHaveBeenCalled();
    expect(prisma.country.update).toHaveBeenCalledTimes(1);
  });
});
