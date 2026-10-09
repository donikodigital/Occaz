// backend/src/trips/trip-arrival.service.spec.ts
// À chaque arrivée du conducteur (départ, ville traversée, destination) : qui reçoit une notification, et quel code.
import { BookingStatus, NotificationChannel, NotificationType, OtpPurpose } from '@prisma/client';
import { TripArrivalService } from './trip-arrival.service';

const TRIP = { id: 'trip1', originCity: { name: 'Lélouma' }, destinationCity: { name: 'Conakry' } };

function booking(
  id: string,
  options: { boardingStopId?: string | null; alightingStopId?: string | null; pickedUp?: boolean; status?: BookingStatus } = {},
) {
  return {
    id,
    status: options.status ?? BookingStatus.CONFIRMED,
    boardingStopId: options.boardingStopId ?? null,
    alightingStopId: options.alightingStopId ?? null,
    passengers: [{ pickedUpAt: options.pickedUp ? new Date() : null }],
    customer: { userId: `user-${id}`, user: { phone: `+22460000${id}` } },
  };
}

function build(bookings: ReturnType<typeof booking>[]) {
  const prisma = { booking: { findMany: jest.fn().mockResolvedValue(bookings) } };
  const otp = { generateAndSend: jest.fn().mockResolvedValue({ expiresInSeconds: 300, smsSent: true }) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const service = new TripArrivalService(prisma as never, otp as never, notifications as never);
  return { service, prisma, otp, notifications };
}

const notifiedUsers = (notifications: { notify: jest.Mock }) => notifications.notify.mock.calls.map(([params]) => params.userId).sort();
const codeBookings = (otp: { generateAndSend: jest.Mock }, purpose: OtpPurpose) =>
  otp.generateAndSend.mock.calls
    .filter(([params]) => params.purpose === purpose)
    .map(([params]) => params.bookingId)
    .sort();

describe('TripArrivalService — départ', () => {
  it('les clients qui montent au départ reçoivent notification (push + email) ET code de prise en charge', async () => {
    const { service, otp, notifications } = build([booking('b1'), booking('b2')]);
    await service.announceArrival(TRIP, { kind: 'ORIGIN' }, 'Lélouma');

    expect(notifiedUsers(notifications)).toEqual(['user-b1', 'user-b2']);
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({
      type: NotificationType.DEPARTURE_IMMINENT,
      channels: [NotificationChannel.PUSH, NotificationChannel.EMAIL],
    });
    expect(notifications.notify.mock.calls[0][0].fallbackBody).toContain('Lélouma → Conakry');
    expect(codeBookings(otp, OtpPurpose.TRIP_PICKUP)).toEqual(['b1', 'b2']);
    expect(codeBookings(otp, OtpPurpose.TRIP_DROPOFF)).toEqual([]);
  });

  it('le code part par SMS vers le téléphone du client, avec le message d\'arrivée', async () => {
    const { service, otp } = build([booking('b1')]);
    await service.announceArrival(TRIP, { kind: 'ORIGIN' }, 'Lélouma');
    expect(otp.generateAndSend).toHaveBeenCalledWith(
      { purpose: OtpPurpose.TRIP_PICKUP, phone: '+22460000b1', bookingId: 'b1' },
      expect.stringContaining('Votre conducteur est arrivé'),
    );
  });

  it('un client qui monte à une étape n\'est pas concerné au départ', async () => {
    const { service, otp, notifications } = build([booking('b1', { boardingStopId: 's-mamou' })]);
    await service.announceArrival(TRIP, { kind: 'ORIGIN' }, 'Lélouma');
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(otp.generateAndSend).not.toHaveBeenCalled();
  });

  it('un client déjà pris en charge ne reçoit pas un second code', async () => {
    const { service, otp, notifications } = build([booking('b1', { pickedUp: true })]);
    await service.announceArrival(TRIP, { kind: 'ORIGIN' }, 'Lélouma');
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(otp.generateAndSend).not.toHaveBeenCalled();
  });
});

describe('TripArrivalService — ville traversée', () => {
  it('Mamou : le client qui descend reçoit son code de dépose, celui qui monte son code de prise en charge', async () => {
    const { service, otp, notifications } = build([
      booking('descend', { alightingStopId: 's-mamou', pickedUp: true }),
      booking('monte', { boardingStopId: 's-mamou' }),
    ]);
    await service.announceArrival(TRIP, { kind: 'STOP', stopId: 's-mamou' }, 'Mamou');

    expect(codeBookings(otp, OtpPurpose.TRIP_DROPOFF)).toEqual(['descend']);
    expect(codeBookings(otp, OtpPurpose.TRIP_PICKUP)).toEqual(['monte']);
    expect(notifiedUsers(notifications)).toEqual(['user-descend', 'user-monte']);

    const forDescending = notifications.notify.mock.calls.find(([params]) => params.userId === 'user-descend')![0];
    expect(forDescending.type).toBe(NotificationType.ARRIVAL);
    expect(forDescending.fallbackTitle).toContain('Mamou');
    expect(forDescending.channels).toEqual([NotificationChannel.PUSH, NotificationChannel.EMAIL]);

    const forBoarding = notifications.notify.mock.calls.find(([params]) => params.userId === 'user-monte')![0];
    expect(forBoarding.type).toBe(NotificationType.DEPARTURE_IMMINENT);
    expect(forBoarding.fallbackBody).toContain('Mamou');
  });

  it('audience « ceux qui descendent » : seuls eux sont prévenus, celui qui monte attend « Je suis arrivé sur les lieux »', async () => {
    const { service, otp, notifications } = build([
      booking('descend', { alightingStopId: 's-mamou', pickedUp: true }),
      booking('monte', { boardingStopId: 's-mamou' }),
    ]);
    await service.announceArrival(TRIP, { kind: 'STOP', stopId: 's-mamou', audience: 'ALIGHTING' }, 'Mamou');
    expect(codeBookings(otp, OtpPurpose.TRIP_DROPOFF)).toEqual(['descend']);
    expect(codeBookings(otp, OtpPurpose.TRIP_PICKUP)).toEqual([]);
    expect(notifiedUsers(notifications)).toEqual(['user-descend']);
  });

  it('audience « ceux qui montent » : seuls eux reçoivent notification et code de prise en charge', async () => {
    const { service, otp, notifications } = build([
      booking('descend', { alightingStopId: 's-mamou', pickedUp: true }),
      booking('monte', { boardingStopId: 's-mamou' }),
    ]);
    await service.announceArrival(TRIP, { kind: 'STOP', stopId: 's-mamou', audience: 'BOARDING' }, 'Mamou');
    expect(codeBookings(otp, OtpPurpose.TRIP_PICKUP)).toEqual(['monte']);
    expect(codeBookings(otp, OtpPurpose.TRIP_DROPOFF)).toEqual([]);
    expect(notifiedUsers(notifications)).toEqual(['user-monte']);
  });

  it('un client d\'une autre ville, ou qui traverse Mamou sans y descendre, ne reçoit rien', async () => {
    const { service, otp, notifications } = build([
      booking('autre-etape', { boardingStopId: 's-kindia' }),
      booking('traverse', { pickedUp: true }), // Lélouma → Conakry : reste à bord
      booking('descend-ailleurs', { alightingStopId: 's-kindia', pickedUp: true }),
    ]);
    await service.announceArrival(TRIP, { kind: 'STOP', stopId: 's-mamou' }, 'Mamou');
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(otp.generateAndSend).not.toHaveBeenCalled();
  });

  it('un client qui devait descendre ici mais n\'a jamais été pris en charge ne reçoit pas de code de dépose', async () => {
    const { service, otp, notifications } = build([booking('absent', { alightingStopId: 's-mamou', pickedUp: false })]);
    await service.announceArrival(TRIP, { kind: 'STOP', stopId: 's-mamou' }, 'Mamou');
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(otp.generateAndSend).not.toHaveBeenCalled();
  });
});

describe('TripArrivalService — destination', () => {
  it('tous les clients à bord reçoivent leur code de dépose, y compris celui dont l\'étape a été dépassée', async () => {
    const { service, otp, notifications } = build([
      booking('jusqu-au-bout', { pickedUp: true }),
      booking('etape-depassee', { alightingStopId: 's-mamou', pickedUp: true }),
      booking('absent', { pickedUp: false }),
    ]);
    await service.announceArrival(TRIP, { kind: 'DESTINATION' }, 'Conakry');

    expect(codeBookings(otp, OtpPurpose.TRIP_DROPOFF)).toEqual(['etape-depassee', 'jusqu-au-bout']);
    expect(codeBookings(otp, OtpPurpose.TRIP_PICKUP)).toEqual([]);
    expect(notifiedUsers(notifications)).toEqual(['user-etape-depassee', 'user-jusqu-au-bout']);
    expect(notifications.notify.mock.calls[0][0].fallbackTitle).toContain('Conakry');
  });
});

describe('TripArrivalService — robustesse', () => {
  it('un SMS en échec pour un client n\'empêche ni les autres clients ni le signalement', async () => {
    const { service, otp, notifications } = build([booking('b1'), booking('b2')]);
    otp.generateAndSend.mockRejectedValueOnce(new Error('passerelle SMS hors service'));
    await expect(service.announceArrival(TRIP, { kind: 'ORIGIN' }, 'Lélouma')).resolves.toBeUndefined();
    expect(otp.generateAndSend).toHaveBeenCalledTimes(2);
    expect(notifications.notify).toHaveBeenCalledTimes(2);
  });

  it('une réservation payée mais pas encore confirmée est prévenue, sans code (la validation exige une réservation confirmée)', async () => {
    const { service, otp, notifications } = build([booking('b1', { status: BookingStatus.PAID })]);
    await service.announceArrival(TRIP, { kind: 'ORIGIN' }, 'Lélouma');
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(otp.generateAndSend).not.toHaveBeenCalled();
  });

  it('ne lit que les réservations payées ou confirmées de CE trajet', async () => {
    const { service, prisma } = build([]);
    await service.announceArrival(TRIP, { kind: 'ORIGIN' }, 'Lélouma');
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId: 'trip1', status: { in: [BookingStatus.PAID, BookingStatus.CONFIRMED] } },
      }),
    );
  });
});

describe('TripArrivalService — bon voyage au départ', () => {
  it('chaque client à bord reçoit le rappel de ceinture par notification (push seulement), les autres non', async () => {
    const { service, prisma, notifications, otp } = build([booking('a'), booking('b')]);
    prisma.booking.findMany.mockResolvedValue([
      { id: 'a', customer: { userId: 'user-a' } },
      { id: 'b', customer: { userId: 'user-b' } },
    ]);
    await service.announceDeparture('trip1');

    // La requête ne retient que les réservations confirmées dont un passager est déjà monté.
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripId: 'trip1', status: BookingStatus.CONFIRMED, passengers: { some: { pickedUpAt: { not: null } } } },
      }),
    );
    expect(notifiedUsers(notifications)).toEqual(['user-a', 'user-b']);
    const params = notifications.notify.mock.calls[0][0];
    expect(params.channels).toEqual([NotificationChannel.PUSH]);
    expect(params.fallbackTitle).toBe('Bon voyage !');
    expect(params.fallbackBody).toContain('ceinture de sécurité');
    expect(otp.generateAndSend).not.toHaveBeenCalled();
  });

  it('une notification en échec n\'empêche ni les autres clients ni le départ', async () => {
    const { service, prisma, notifications } = build([]);
    prisma.booking.findMany.mockResolvedValue([
      { id: 'a', customer: { userId: 'user-a' } },
      { id: 'b', customer: { userId: 'user-b' } },
    ]);
    notifications.notify.mockRejectedValueOnce(new Error('push indisponible'));
    await expect(service.announceDeparture('trip1')).resolves.toBeUndefined();
    expect(notifications.notify).toHaveBeenCalledTimes(2);
  });
});
