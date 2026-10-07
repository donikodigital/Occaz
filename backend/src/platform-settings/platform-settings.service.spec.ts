// backend/src/platform-settings/platform-settings.service.spec.ts
import { BadRequestException } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService — réglages gérés par leur propre page', () => {
  const build = () => {
    const prisma = { platformSetting: { upsert: jest.fn().mockResolvedValue({ id: 's1' }), findUnique: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() } };
    const audit = { log: jest.fn() };
    return { service: new PlatformSettingsService(prisma as never, audit as never), prisma };
  };

  it('refuse d\'écrire une clé « trip_pricing.* » par l\'API générique', async () => {
    const { service, prisma } = build();
    await expect(service.upsert({ key: 'trip_pricing.mode', value: 'AUTO' } as never, 'admin1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it('refuse de supprimer une clé « trip_pricing.* »', async () => {
    const { service } = build();
    await expect(service.remove('trip_pricing.config.gnf', 'admin1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('les autres réglages restent modifiables', async () => {
    const { service, prisma } = build();
    await service.upsert({ key: 'trip.search_radius_km', value: 8 } as never, 'admin1');
    expect(prisma.platformSetting.upsert).toHaveBeenCalledTimes(1);
  });
});
