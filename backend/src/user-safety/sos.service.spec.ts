// backend/src/user-safety/sos.service.spec.ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SosStatus } from '@prisma/client';
import { SosService } from './sos.service';

const USER = { id: 'u1', phone: '+224620000001', customerProfile: { firstName: 'Fatoumata', lastName: 'Diallo' }, driverProfile: null };
const CONTACTS = [
  { id: 'e1', userId: 'u1', name: 'Mariama', phone: '+224620000002' },
  { id: 'e2', userId: 'u1', name: 'Oumar', phone: '+224620000003' },
];

function alertRow(extra: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    userId: 'u1',
    status: SosStatus.OPEN,
    latitude: 9.5092,
    longitude: -13.7122,
    contactsNotified: 0,
    createdAt: new Date('2026-10-10T20:00:00Z'),
    ...extra,
  };
}

function build(options: { active?: unknown; contacts?: unknown[]; smsFailures?: string[] } = {}) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue(USER) },
    sosAlert: {
      findFirst: jest.fn().mockResolvedValue(options.active ?? null),
      create: jest.fn().mockResolvedValue(alertRow()),
      update: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve(alertRow(data))),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      findUnique: jest.fn(),
    },
    emergencyContact: {
      findMany: jest.fn().mockResolvedValue(options.contacts ?? CONTACTS),
      count: jest.fn().mockResolvedValue((options.contacts ?? CONTACTS).length),
    },
    booking: { findUnique: jest.fn().mockResolvedValue(null), count: jest.fn().mockResolvedValue(0) },
    trip: { findUnique: jest.fn().mockResolvedValue(null) },
    shipment: { findUnique: jest.fn().mockResolvedValue(null) },
  };
  const notifications = { notifyStaff: jest.fn().mockResolvedValue(undefined), notify: jest.fn().mockResolvedValue(undefined) };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const failures = new Set(options.smsFailures ?? []);
  const sms = {
    send: jest.fn().mockImplementation((phone: string) => (failures.has(phone) ? Promise.reject(new Error('SMS down')) : Promise.resolve())),
  };
  const service = new SosService(prisma as never, notifications as never, audit as never, sms as never);
  return { service, prisma, notifications, audit, sms };
}

describe('SosService.trigger', () => {
  it('crée l’alerte, prévient chaque proche par SMS avec la position, et alerte le support', async () => {
    const { service, prisma, sms, notifications } = build();
    const result = await service.trigger('u1', { latitude: 9.5092, longitude: -13.7122 });

    expect(prisma.sosAlert.create).toHaveBeenCalledTimes(1);
    expect(sms.send).toHaveBeenCalledTimes(2);
    const [phone, text] = sms.send.mock.calls[0];
    expect(phone).toBe('+224620000002');
    expect(text).toContain('Fatoumata Diallo');
    expect(text).toContain('+224620000001');
    expect(text).toContain('https://www.google.com/maps?q=9.509200,-13.712200');
    expect(notifications.notifyStaff).toHaveBeenCalledWith(expect.objectContaining({ permission: 'sos.read', email: true }));
    expect(result).toMatchObject({ status: 'OPEN', contactsNotified: 2, contactsTotal: 2, hasLocation: true, alreadyActive: false });
  });

  it('un SMS en échec n’empêche ni les autres SMS ni l’alerte, et le compte est exact', async () => {
    const { service } = build({ smsFailures: ['+224620000002'] });
    const result = await service.trigger('u1', {});
    expect(result).toMatchObject({ contactsNotified: 1, contactsTotal: 2 });
  });

  it('fonctionne sans aucun proche enregistré : le support est quand même alerté', async () => {
    const { service, sms, notifications } = build({ contacts: [] });
    const result = await service.trigger('u1', {});
    expect(sms.send).not.toHaveBeenCalled();
    expect(notifications.notifyStaff).toHaveBeenCalled();
    expect(result).toMatchObject({ contactsNotified: 0, contactsTotal: 0 });
  });

  it('un second appui n’envoie pas de nouveaux SMS : il met seulement la position à jour', async () => {
    const { service, prisma, sms, notifications } = build({ active: alertRow({ contactsNotified: 2 }) });
    const result = await service.trigger('u1', { latitude: 9.6, longitude: -13.6 });
    expect(prisma.sosAlert.create).not.toHaveBeenCalled();
    expect(sms.send).not.toHaveBeenCalled();
    expect(notifications.notifyStaff).not.toHaveBeenCalled();
    expect(prisma.sosAlert.update).toHaveBeenCalledWith({ where: { id: 'a1' }, data: { latitude: 9.6, longitude: -13.6 } });
    expect(result.alreadyActive).toBe(true);
  });

  it('latitude sans longitude : refusé', async () => {
    const { service } = build();
    await expect(service.trigger('u1', { latitude: 9.5 })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('une référence de trajet qui ne concerne pas la personne est ignorée, sans bloquer l’alerte', async () => {
    const { service, prisma } = build();
    prisma.trip.findUnique.mockResolvedValue({
      id: 't9',
      originCity: { name: 'Conakry' },
      destinationCity: { name: 'Labé' },
      driver: { userId: 'someone-else' },
    });
    prisma.booking.count.mockResolvedValue(0);
    await service.trigger('u1', { tripId: 't9' });
    expect(prisma.sosAlert.create.mock.calls[0][0].data.tripId).toBeUndefined();
  });

  it('un trajet de la personne est conservé et nommé dans le SMS', async () => {
    const { service, prisma, sms } = build();
    prisma.trip.findUnique.mockResolvedValue({
      id: 't1',
      originCity: { name: 'Conakry' },
      destinationCity: { name: 'Labé' },
      driver: { userId: 'u1' },
    });
    await service.trigger('u1', { tripId: 't1' });
    expect(prisma.sosAlert.create.mock.calls[0][0].data.tripId).toBe('t1');
    expect(sms.send.mock.calls[0][1]).toContain('Conakry → Labé');
  });
});

describe('SosService.cancel', () => {
  it('annule l’alerte et rassure les proches déjà prévenus', async () => {
    const { service, prisma, sms } = build();
    prisma.sosAlert.findFirst.mockResolvedValue(alertRow({ contactsNotified: 2 }));
    await expect(service.cancel('u1', 'a1')).resolves.toEqual({ cancelled: true });
    expect(prisma.sosAlert.update.mock.calls[0][0].data.status).toBe(SosStatus.CANCELLED);
    expect(sms.send).toHaveBeenCalledTimes(2);
    expect(sms.send.mock.calls[0][1]).toContain('Fausse alerte');
  });

  it('ne dérange pas les proches qui n’avaient pas été prévenus', async () => {
    const { service, prisma, sms } = build();
    prisma.sosAlert.findFirst.mockResolvedValue(alertRow({ contactsNotified: 0 }));
    await service.cancel('u1', 'a1');
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('alerte introuvable ou déjà terminée : 404', async () => {
    const { service } = build();
    await expect(service.cancel('u1', 'nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('SosService.handle (support)', () => {
  it('accuse réception : prévient la personne et trace l’action', async () => {
    const { service, prisma, notifications, audit } = build();
    prisma.sosAlert.findUnique.mockResolvedValue(alertRow());
    await service.handle('a1', { status: 'ACKNOWLEDGED' }, 'agent1');
    expect(notifications.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ entityType: 'SosAlert', action: 'sos.handle' }));
  });

  it('clôture avec une note', async () => {
    const { service, prisma } = build();
    prisma.sosAlert.findUnique.mockResolvedValue(alertRow({ status: SosStatus.ACKNOWLEDGED }));
    await service.handle('a1', { status: 'RESOLVED', resolutionNote: ' Joint au téléphone ' }, 'agent1');
    const data = prisma.sosAlert.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: 'RESOLVED', resolutionNote: 'Joint au téléphone', handledById: 'agent1' });
    expect(data.handledAt).toBeInstanceOf(Date);
  });

  it('une alerte annulée par la personne ne se rouvre pas', async () => {
    const { service, prisma } = build();
    prisma.sosAlert.findUnique.mockResolvedValue(alertRow({ status: SosStatus.CANCELLED }));
    await expect(service.handle('a1', { status: 'ACKNOWLEDGED' }, 'agent1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
