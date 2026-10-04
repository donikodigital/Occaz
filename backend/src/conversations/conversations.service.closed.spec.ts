// backend/src/conversations/conversations.service.closed.spec.ts
// Messagerie : fermée entre le client et le conducteur quand la prestation est terminée ; le support peut toujours écrire.
import { ForbiddenException } from '@nestjs/common';
import { ConversationsService } from './conversations.service';

function build(options: { bookingStatus?: string; shipmentStatus?: string; kind: 'booking' | 'shipment' }) {
  const conversation = {
    id: 'cv1',
    bookingId: options.kind === 'booking' ? 'b1' : null,
    shipmentId: options.kind === 'shipment' ? 's1' : null,
    customer: { userId: 'u-customer' },
    driver: { userId: 'u-driver' },
  };
  const prisma = {
    conversation: { findUnique: jest.fn().mockResolvedValue(conversation) },
    booking: { findUnique: jest.fn().mockResolvedValue({ status: options.bookingStatus ?? 'CONFIRMED' }) },
    shipment: { findUnique: jest.fn().mockResolvedValue({ status: options.shipmentStatus ?? 'IN_TRANSIT' }) },
    message: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'm1', ...data })) },
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new ConversationsService(prisma as never, notifications as never);
  return { service, prisma };
}

const customer = { id: 'u-customer', hasSupportAccess: false };
const driver = { id: 'u-driver', hasSupportAccess: false };
const support = { id: 'u-support', hasSupportAccess: true };

describe('ConversationsService.sendMessage — conversation fermée', () => {
  it('trajet en cours : le client et le conducteur s\'écrivent comme avant', async () => {
    const { service, prisma } = build({ kind: 'booking', bookingStatus: 'CONFIRMED' });
    await expect(service.sendMessage('cv1', customer, 'Bonjour')).resolves.toBeDefined();
    await expect(service.sendMessage('cv1', driver, 'Bonjour')).resolves.toBeDefined();
    expect(prisma.message.create).toHaveBeenCalledTimes(2);
  });

  it('trajet terminé (réservation COMPLETED) : plus de nouveau message du client ni du conducteur', async () => {
    const { service, prisma } = build({ kind: 'booking', bookingStatus: 'COMPLETED' });
    await expect(service.sendMessage('cv1', customer, 'Merci')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage('cv1', driver, 'Merci')).rejects.toThrow(/fermée/);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it.each(['DELIVERED', 'COMPLETED'])('colis %s : conversation fermée', async (shipmentStatus) => {
    const { service, prisma } = build({ kind: 'shipment', shipmentStatus });
    await expect(service.sendMessage('cv1', customer, 'Merci')).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.message.create).not.toHaveBeenCalled();
  });

  it('colis en cours : conversation ouverte', async () => {
    const { service } = build({ kind: 'shipment', shipmentStatus: 'IN_TRANSIT' });
    await expect(service.sendMessage('cv1', driver, 'J\'arrive')).resolves.toBeDefined();
  });

  it('le support peut toujours écrire dans une conversation fermée (litige)', async () => {
    const { service, prisma } = build({ kind: 'booking', bookingStatus: 'COMPLETED' });
    await expect(service.sendMessage('cv1', support, 'Nous examinons votre demande')).resolves.toMatchObject({ isSupportIntervention: true });
    expect(prisma.message.create).toHaveBeenCalledTimes(1);
  });
});
