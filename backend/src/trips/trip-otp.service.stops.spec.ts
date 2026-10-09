// backend/src/trips/trip-otp.service.stops.spec.ts
// Prise en charge : au départ (conducteur arrivé) ou à une étape (trajet en cours).
import { BadRequestException } from '@nestjs/common';
import { BookingStatus, TripStatus } from '@prisma/client';
import { TripOtpService } from './trip-otp.service';

function build(booking: { boardingStopId: string | null; tripStatus: TripStatus }) {
  const row = {
    id: 'b1',
    tripId: 'trip1',
    customerId: 'c1',
    status: BookingStatus.CONFIRMED,
    boardingStopId: booking.boardingStopId,
    trip: { driverId: 'd1', status: booking.tripStatus },
    customer: { user: { phone: '+224600000000' } },
  };
  const prisma = { booking: { findUnique: jest.fn().mockResolvedValue(row) } };
  const otp = { generateAndSend: jest.fn().mockResolvedValue({ sent: true }) };
  const service = new TripOtpService(prisma as never, otp as never, {} as never, { notify: jest.fn() } as never);
  return { service, otp };
}

describe('TripOtpService — prise en charge au départ ou à une étape', () => {
  it('client du départ : code autorisé quand le conducteur est arrivé au point de départ', async () => {
    const { service, otp } = build({ boardingStopId: null, tripStatus: TripStatus.DRIVER_ARRIVED });
    await service.requestPickupOtp('b1', 'd1');
    expect(otp.generateAndSend).toHaveBeenCalled();
  });

  it('client du départ : refusé quand le trajet est déjà en cours (comportement inchangé)', async () => {
    const { service } = build({ boardingStopId: null, tripStatus: TripStatus.IN_PROGRESS });
    await expect(service.requestPickupOtp('b1', 'd1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('client d\'une étape : code autorisé pendant le trajet en cours', async () => {
    const { service, otp } = build({ boardingStopId: 's-kindia', tripStatus: TripStatus.IN_PROGRESS });
    await service.requestPickupOtp('b1', 'd1');
    expect(otp.generateAndSend).toHaveBeenCalled();
  });

  it('client d\'une étape : refusé tant que le conducteur est encore au point de départ', async () => {
    const { service } = build({ boardingStopId: 's-kindia', tripStatus: TripStatus.DRIVER_ARRIVED });
    await expect(service.requestPickupOtp('b1', 'd1')).rejects.toThrow(/étape/);
  });

  it('le client d\'une étape retrouve son code dans l\'app une fois le conducteur arrivé à son étape', async () => {
    const { service, otp } = build({ boardingStopId: 's-kindia', tripStatus: TripStatus.IN_PROGRESS });
    await service.revealPickupOtpForCustomer('b1', 'c1');
    expect(otp.generateAndSend).toHaveBeenCalledWith(expect.anything(), expect.any(String), { revealCodeToCaller: true });
  });

  it('le client d\'une étape ne reçoit pas son code avant l\'arrivée du conducteur', async () => {
    const { service } = build({ boardingStopId: 's-kindia', tripStatus: TripStatus.PUBLISHED });
    await expect(service.revealPickupOtpForCustomer('b1', 'c1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TripOtpService — le code de dépose ne part plus à la prise en charge', () => {
  function buildForPickup(tripStatus: TripStatus) {
    const row = {
      id: 'b1',
      tripId: 'trip1',
      customerId: 'c1',
      status: BookingStatus.CONFIRMED,
      boardingStopId: null,
      trip: { driverId: 'd1', status: tripStatus },
      customer: { user: { phone: '+224600000000' } },
    };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(row) },
      tripPassenger: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trip: { update: jest.fn().mockResolvedValue({}) },
    };
    const otp = { generateAndSend: jest.fn(), verify: jest.fn().mockResolvedValue(undefined) };
    const service = new TripOtpService(prisma as never, otp as never, {} as never, { notify: jest.fn() } as never);
    return { service, prisma, otp };
  }

  it('valider la prise en charge marque le passager à bord, sans générer ni envoyer de code de dépose', async () => {
    const { service, prisma, otp } = buildForPickup(TripStatus.DRIVER_ARRIVED);
    await service.verifyPickupOtp('b1', 'd1', '123456');

    expect(prisma.tripPassenger.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bookingId: 'b1' }, data: { pickedUpAt: expect.any(Date) } }),
    );
    expect(prisma.trip.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: TripStatus.PASSENGER_PICKED_UP } }),
    );
    // Le code de dépose part à l'arrivée au point de descente (TripArrivalService), pas ici.
    expect(otp.generateAndSend).not.toHaveBeenCalled();
  });

  it('le conducteur peut toujours renvoyer le code de dépose à la demande', async () => {
    const { service, otp } = build({ boardingStopId: null, tripStatus: TripStatus.IN_PROGRESS });
    await service.requestDropoffOtp('b1', 'd1');
    expect(otp.generateAndSend).toHaveBeenCalledWith(
      expect.objectContaining({ purpose: 'TRIP_DROPOFF', bookingId: 'b1' }),
      expect.stringContaining('fin de votre trajet'),
    );
  });
});

describe('TripOtpService — message de bienvenue après la dépose', () => {
  function buildForDropoff(options: { notifyFails?: boolean; alightingCity?: string | null } = {}) {
    const row = {
      id: 'b1',
      tripId: 'trip1',
      customerId: 'c1',
      status: BookingStatus.CONFIRMED,
      boardingStopId: null,
      trip: { driverId: 'd1', status: TripStatus.IN_PROGRESS, destinationCity: { name: 'Conakry' } },
      customer: { userId: 'u-client', user: { phone: '+224600000000' } },
      alightingStop: options.alightingCity === null ? null : { city: { name: options.alightingCity ?? 'Kissidougou' } },
    };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(row), update: jest.fn().mockResolvedValue({}) },
      tripPassenger: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const otp = { verify: jest.fn().mockResolvedValue(undefined) };
    const wallets = { releaseHeldFunds: jest.fn().mockResolvedValue(undefined) };
    const notifications = {
      notify: options.notifyFails ? jest.fn().mockRejectedValue(new Error('push indisponible')) : jest.fn().mockResolvedValue(undefined),
    };
    const service = new TripOtpService(prisma as never, otp as never, wallets as never, notifications as never);
    return { service, prisma, wallets, notifications };
  }

  it('le client reçoit un mot de bienvenue (notification + email) dans sa ville d\'arrivée', async () => {
    const { service, notifications } = buildForDropoff();
    await service.verifyDropoffOtp('b1', 'd1', '123456');

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const params = notifications.notify.mock.calls[0][0];
    expect(params.userId).toBe('u-client');
    expect(params.channels).toEqual(['PUSH', 'EMAIL']);
    expect(params.fallbackTitle).toBe('Bienvenue à Kissidougou !');
    expect(params.fallbackBody).toContain('excellent séjour à Kissidougou');
    expect(params.pushData).toEqual({ type: 'ARRIVAL', tripId: 'trip1', bookingId: 'b1' });
  });

  it('sans étape de descente, la ville de bienvenue est la destination du trajet', async () => {
    const { service, notifications } = buildForDropoff({ alightingCity: null });
    await service.verifyDropoffOtp('b1', 'd1', '123456');
    expect(notifications.notify.mock.calls[0][0].fallbackTitle).toBe('Bienvenue à Conakry !');
  });

  it('le message part après le paiement du conducteur, et son échec ne défait rien', async () => {
    const { service, prisma, wallets, notifications } = buildForDropoff({ notifyFails: true });
    await expect(service.verifyDropoffOtp('b1', 'd1', '123456')).resolves.toBeUndefined();
    expect(prisma.booking.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: BookingStatus.COMPLETED } }));
    expect(wallets.releaseHeldFunds).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });
});

describe('TripOtpService — bon voyage d\'un client qui monte en cours de route', () => {
  function buildPickup(tripStatus: TripStatus) {
    const row = {
      id: 'b1',
      tripId: 'trip1',
      customerId: 'c1',
      status: BookingStatus.CONFIRMED,
      boardingStopId: 's-kindia',
      trip: { driverId: 'd1', status: tripStatus },
      customer: { userId: 'u-client', user: { phone: '+224600000000' } },
    };
    const prisma = {
      booking: { findUnique: jest.fn().mockResolvedValue(row) },
      tripPassenger: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      trip: { update: jest.fn().mockResolvedValue({}) },
    };
    const otp = { verify: jest.fn().mockResolvedValue(undefined) };
    const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
    const service = new TripOtpService(prisma as never, otp as never, {} as never, notifications as never);
    return { service, notifications };
  }

  it('monté à une étape, trajet en cours : rappel de ceinture tout de suite', async () => {
    const { service, notifications } = buildPickup(TripStatus.IN_PROGRESS);
    await service.verifyPickupOtp('b1', 'd1', '123456');
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][0]).toMatchObject({ userId: 'u-client', fallbackTitle: 'Bon voyage !' });
  });

  it('monté au départ (trajet pas encore démarré) : rien maintenant, le message part au démarrage', async () => {
    const { service, notifications } = buildPickup(TripStatus.DRIVER_ARRIVED);
    await service.verifyPickupOtp('b1', 'd1', '123456');
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
