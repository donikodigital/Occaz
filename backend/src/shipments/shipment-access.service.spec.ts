// backend/src/shipments/shipment-access.service.spec.ts
// Preuves d'un envoi : expéditeur, conducteur de l'envoi et personnel autorisé seulement (faille BOLA corrigée).
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { ShipmentAccessService } from './shipment-access.service';

const user = (over: Record<string, unknown> = {}) => ({ id: 'u1', accountType: 'CUSTOMER', permissions: [], countryScopes: {}, ...over }) as never;

function build(options: { shipment?: { customerId: string; driverId: string | null } | null; customerId?: string | null; driverId?: string | null } = {}) {
  const prisma = { shipment: { findUnique: jest.fn().mockResolvedValue(options.shipment === undefined ? { id: 's1', customerId: 'c1', driverId: 'd1' } : options.shipment && { id: 's1', ...options.shipment }) } };
  const scope = { assertShipment: jest.fn().mockResolvedValue(undefined) };
  const customers = { findByUserId: jest.fn().mockImplementation(() => (options.customerId ? Promise.resolve({ id: options.customerId }) : Promise.reject(new Error('none')))) };
  const drivers = { getProfileIdForUser: jest.fn().mockImplementation(() => (options.driverId ? Promise.resolve(options.driverId) : Promise.reject(new Error('none')))) };
  return { service: new ShipmentAccessService(prisma as never, scope as never, customers as never, drivers as never), scope };
}

describe('ShipmentAccessService.assertCanAccessEvidence', () => {
  it('l\'expéditeur de l\'envoi passe', async () => {
    await expect(build({ customerId: 'c1' }).service.assertCanAccessEvidence(user(), 's1', 'read')).resolves.toBeUndefined();
  });
  it('le conducteur de l\'envoi passe', async () => {
    await expect(build({ driverId: 'd1' }).service.assertCanAccessEvidence(user({ accountType: 'DRIVER' }), 's1', 'write')).resolves.toBeUndefined();
  });
  it('un autre client est refusé (403)', async () => {
    await expect(build({ customerId: 'c-other' }).service.assertCanAccessEvidence(user(), 's1', 'read')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('un autre conducteur est refusé (403)', async () => {
    await expect(build({ driverId: 'd-other' }).service.assertCanAccessEvidence(user({ accountType: 'DRIVER' }), 's1', 'write')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('un envoi sans conducteur n\'ouvre pas l\'accès à un conducteur quelconque', async () => {
    await expect(build({ shipment: { customerId: 'c1', driverId: null }, driverId: 'd1' }).service.assertCanAccessEvidence(user(), 's1', 'read')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('envoi inexistant : 404', async () => {
    await expect(build({ shipment: null }).service.assertCanAccessEvidence(user(), 'nope', 'read')).rejects.toBeInstanceOf(NotFoundException);
  });
  it('personnel : lecture avec shipment.read dans son périmètre pays', async () => {
    const { service, scope } = build();
    await service.assertCanAccessEvidence(user({ accountType: 'SUPPORT', permissions: [PERMISSIONS.SHIPMENT_READ] }), 's1', 'read');
    expect(scope.assertShipment).toHaveBeenCalledWith(expect.anything(), PERMISSIONS.SHIPMENT_READ, 's1');
  });
  it('personnel : l\'ajout exige shipment.update (shipment.read ne suffit pas)', async () => {
    const { service } = build();
    await expect(service.assertCanAccessEvidence(user({ accountType: 'SUPPORT', permissions: [PERMISSIONS.SHIPMENT_READ] }), 's1', 'write')).rejects.toBeInstanceOf(ForbiddenException);
  });
});
