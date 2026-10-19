// backend/src/account-roles/self-dealing.service.spec.ts
// Pas de transaction avec soi-même : réserver son propre trajet, transporter son propre envoi.
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SelfDealingService } from './self-dealing.service';

function build(overrides: { trip?: unknown; shipment?: unknown; invitation?: unknown } = {}) {
  const prisma = {
    trip: { findUnique: jest.fn().mockResolvedValue('trip' in overrides ? overrides.trip : { driver: { userId: 'u-driver' } }) },
    shipment: { findUnique: jest.fn().mockResolvedValue('shipment' in overrides ? overrides.shipment : { customer: { userId: 'u-sender' } }) },
    shipmentInvitation: {
      findUnique: jest.fn().mockResolvedValue('invitation' in overrides ? overrides.invitation : { shipment: { customer: { userId: 'u-sender' } } }),
    },
  };
  return new SelfDealingService(prisma as never);
}

describe('SelfDealingService', () => {
  it('refuse de réserver son propre trajet, accepte celui d\'un autre', async () => {
    await expect(build().assertNotOwnTrip('u-driver', 't1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().assertNotOwnTrip('u-other', 't1')).resolves.toBeUndefined();
    await expect(build({ trip: null }).assertNotOwnTrip('u-other', 't1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse de transporter son propre envoi, accepte celui d\'un autre', async () => {
    await expect(build().assertNotOwnShipment('u-sender', 's1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().assertNotOwnShipment('u-other', 's1')).resolves.toBeUndefined();
    await expect(build({ shipment: null }).assertNotOwnShipment('u-other', 's1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('même règle pour une invitation reçue', async () => {
    await expect(build().assertNotOwnInvitation('u-sender', 'i1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(build().assertNotOwnInvitation('u-other', 'i1')).resolves.toBeUndefined();
    await expect(build({ invitation: null }).assertNotOwnInvitation('u-other', 'i1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
