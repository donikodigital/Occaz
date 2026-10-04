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
  const service = new TripOtpService(prisma as never, otp as never, {} as never);
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
