// backend/src/trips/trips.service.compliance.spec.ts
// Conducteur en attente de validation : la création et la publication de trajets passent par la règle de régularisation du dossier.
import { ForbiddenException } from '@nestjs/common';
import { TripsService } from './trips.service';

function createService(assertCanCreateTrips: jest.Mock) {
  const vehicles = { assertOwnership: jest.fn().mockRejectedValue(new Error('véhicule consulté : la règle de dossier est passée')) };
  const service = new TripsService(
    {} as never,
    {} as never,
    vehicles as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    { assertCanCreateTrips } as never,
  );
  return { service, vehicles };
}

describe('TripsService — régularisation du dossier conducteur', () => {
  it('create : un conducteur bloqué (délai dépassé) est refusé avant tout autre contrôle', async () => {
    const assert = jest.fn().mockRejectedValue(new ForbiddenException('Le délai est dépassé.'));
    const { service, vehicles } = createService(assert);
    await expect(service.create('d1', {} as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(assert).toHaveBeenCalledWith('d1');
    expect(vehicles.assertOwnership).not.toHaveBeenCalled();
  });

  it('create : dans le délai, la création continue normalement', async () => {
    const assert = jest.fn().mockResolvedValue({ canCreateTrips: true });
    const { service, vehicles } = createService(assert);
    await expect(service.create('d1', { vehicleId: 'v1' } as never)).rejects.toThrow('règle de dossier est passée');
    expect(vehicles.assertOwnership).toHaveBeenCalled();
  });

  it('publish : un conducteur bloqué ne peut pas publier non plus', async () => {
    const assert = jest.fn().mockRejectedValue(new ForbiddenException('Le délai est dépassé.'));
    const { service } = createService(assert);
    await expect(service.publish('t1', 'd1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(assert).toHaveBeenCalledWith('d1');
  });
});
