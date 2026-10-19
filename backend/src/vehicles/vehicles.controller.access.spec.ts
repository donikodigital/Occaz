// backend/src/vehicles/vehicles.controller.access.spec.ts
// GET /vehicles/:id et /documents : propriétaire ou personnel autorisé seulement (faille BOLA corrigée).
import { ForbiddenException } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { VehiclesController } from './vehicles.controller';

function build(options: { driverId?: string | null } = {}) {
  const vehicles = {
    findOne: jest.fn().mockResolvedValue({ id: 'v1', driverId: 'd1' }),
    findDocuments: jest.fn().mockResolvedValue([{ id: 'doc1' }]),
  };
  const drivers = { getProfileIdForUser: jest.fn().mockImplementation(() => (options.driverId ? Promise.resolve(options.driverId) : Promise.reject(new Error('none')))) };
  const scope = { assertVehicle: jest.fn().mockResolvedValue(undefined) };
  const controller = new VehiclesController(vehicles as never, drivers as never, scope as never);
  return { controller, vehicles, scope };
}
const user = (permissions: string[] = []) => ({ id: 'u1', accountType: 'DRIVER', permissions, countryScopes: {} }) as never;

describe('VehiclesController — lecture', () => {
  it('le propriétaire lit sa fiche et ses documents', async () => {
    const { controller, vehicles } = build({ driverId: 'd1' });
    await expect(controller.findOne('v1', user())).resolves.toMatchObject({ id: 'v1' });
    await expect(controller.findDocuments('v1', user())).resolves.toHaveLength(1);
    expect(vehicles.findDocuments).toHaveBeenCalledWith('v1');
  });

  it('un autre conducteur est refusé (403) et ne reçoit aucun document', async () => {
    const { controller, vehicles } = build({ driverId: 'd-other' });
    await expect(controller.findOne('v1', user())).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.findDocuments('v1', user())).rejects.toBeInstanceOf(ForbiddenException);
    expect(vehicles.findDocuments).not.toHaveBeenCalled();
  });

  it('un client (sans profil conducteur) est refusé', async () => {
    const { controller } = build({ driverId: null });
    await expect(controller.findOne('v1', user())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('le personnel avec vehicle.read passe, dans son périmètre pays', async () => {
    const { controller, scope } = build({ driverId: null });
    await controller.findOne('v1', user([PERMISSIONS.VEHICLE_READ]));
    expect(scope.assertVehicle).toHaveBeenCalledWith(expect.anything(), PERMISSIONS.VEHICLE_READ, 'v1');
  });
});
