// backend/src/disputes/disputes.service.resolve.spec.ts
// Résolution d'un litige : remboursement au montant exact, erreurs jamais avalées, annulation sans double effet.
import { BadRequestException } from '@nestjs/common';
import { BookingStatus, DisputeResolutionType, DisputeStatus, PaymentStatus, ServiceType } from '@prisma/client';
import { DisputesService } from './disputes.service';

function build(options: {
  paymentStatus?: PaymentStatus;
  refundResult?: bigint | Error;
  claimCount?: number;
  releaseFails?: boolean;
} = {}) {
  const dispute = {
    id: 'd1',
    status: DisputeStatus.OPENED,
    resolution: null,
    subjectType: ServiceType.TRIP,
    bookingId: 'b1',
    shipmentId: null,
  };
  const payment = { id: 'pay1', amount: 20_000n, currencyId: 'GNF', status: options.paymentStatus ?? PaymentStatus.CAPTURED };
  const tx = {
    booking: { updateMany: jest.fn().mockResolvedValue({ count: options.claimCount ?? 1 }), findMany: jest.fn().mockResolvedValue([]) },
    trip: { findUnique: jest.fn().mockResolvedValue({ id: 't1', totalSeats: 4, departureAt: new Date(), pricePerSeat: 1n, originCityId: 'a', originLocationId: 'la', destinationCityId: 'b', destinationLocationId: 'lb', stops: [] }), update: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ status: 'PUBLISHED', totalSeats: 4 }]),
  };
  const prisma = {
    payment: { findUnique: jest.fn().mockResolvedValue(payment) },
    booking: {
      findUnique: jest.fn().mockResolvedValue({ id: 'b1', tripId: 't1', status: BookingStatus.CONFIRMED, trip: { driverId: 'dr1' } }),
    },
    disputeResolution: { create: jest.fn().mockResolvedValue({ id: 'res1' }) },
    dispute: { update: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation((cb: (c: unknown) => unknown) => cb(tx)),
  };
  const payments = {
    refundBooking: jest.fn().mockImplementation(() =>
      options.refundResult instanceof Error ? Promise.reject(options.refundResult) : Promise.resolve(options.refundResult ?? 7_500n),
    ),
    refundShipment: jest.fn().mockResolvedValue(0n),
  };
  const wallets = {
    releaseHeldFunds: options.releaseFails ? jest.fn().mockRejectedValue(new Error('libération concurrente')) : jest.fn().mockResolvedValue(undefined),
  };
  const audit = { log: jest.fn().mockResolvedValue(undefined) };
  const service = new DisputesService(
    prisma as never, audit as never, {} as never, payments as never, wallets as never, {} as never, { notify: jest.fn() } as never,
    {} as never, {} as never, {} as never,
  );
  jest.spyOn(service, 'findOne').mockResolvedValue(dispute as never);
  jest.spyOn(service as never, 'notifyResolutionParties').mockResolvedValue(undefined as never);
  return { service, prisma, payments, wallets, tx };
}

const resolve = (service: DisputesService, dto: Record<string, unknown>) => service.resolve('d1', dto as never, 'admin1');

describe('DisputesService.resolve — remboursements', () => {
  it('remboursement partiel : le montant EXACT est transmis (7 500 sur 20 000, plus d’arrondi au pourcent)', async () => {
    const { service, payments, prisma } = build();
    await resolve(service, { type: DisputeResolutionType.PARTIAL_REFUND, refundAmount: '7500' });
    expect(payments.refundBooking).toHaveBeenCalledWith('b1', 0, { amount: 7_500n });
    expect(prisma.disputeResolution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refundAmount: 7_500n, currencyId: 'GNF' }) }),
    );
  });

  it('la résolution enregistre ce qui a RÉELLEMENT été remboursé (plafonné par le solde restant)', async () => {
    const { service, prisma } = build({ paymentStatus: PaymentStatus.PARTIALLY_REFUNDED, refundResult: 5_000n });
    await resolve(service, { type: DisputeResolutionType.PARTIAL_REFUND, refundAmount: '7500' });
    expect(prisma.disputeResolution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ refundAmount: 5_000n }) }),
    );
  });

  it('le prestataire échoue : l’erreur remonte, le litige n’est PAS marqué résolu', async () => {
    const { service, prisma } = build({ refundResult: new Error('prestataire indisponible') });
    await expect(resolve(service, { type: DisputeResolutionType.PARTIAL_REFUND, refundAmount: '7500' })).rejects.toThrow('prestataire indisponible');
    expect(prisma.disputeResolution.create).not.toHaveBeenCalled();
    expect(prisma.dispute.update).not.toHaveBeenCalled();
  });

  it('montant supérieur au paiement : refusé', async () => {
    const { service, payments } = build();
    await expect(resolve(service, { type: DisputeResolutionType.PARTIAL_REFUND, refundAmount: '25000' })).rejects.toBeInstanceOf(BadRequestException);
    expect(payments.refundBooking).not.toHaveBeenCalled();
  });

  it('déjà entièrement remboursé : refusé avec un message clair, sans résolution fantôme', async () => {
    const { service, prisma } = build({ refundResult: 0n });
    await expect(resolve(service, { type: DisputeResolutionType.PARTIAL_REFUND, refundAmount: '7500' })).rejects.toThrow(/déjà entièrement remboursé/);
    expect(prisma.disputeResolution.create).not.toHaveBeenCalled();
  });

  it('paiement jamais capturé : refusé', async () => {
    const { service } = build({ paymentStatus: PaymentStatus.PENDING });
    await expect(resolve(service, { type: DisputeResolutionType.PARTIAL_REFUND, refundAmount: '7500' })).rejects.toThrow(/Aucun paiement remboursable/);
  });

  it('remboursement intégral : 100 %', async () => {
    const { service, payments } = build({ refundResult: 20_000n });
    await resolve(service, { type: DisputeResolutionType.FULL_REFUND });
    expect(payments.refundBooking).toHaveBeenCalledWith('b1', 100);
  });
});

describe('DisputesService.resolve — paiement du conducteur et annulation', () => {
  it('paiement du conducteur : une erreur de libération n’est plus avalée', async () => {
    const { service, prisma } = build({ releaseFails: true });
    await expect(resolve(service, { type: DisputeResolutionType.DRIVER_PAYOUT })).rejects.toThrow('libération concurrente');
    expect(prisma.dispute.update).not.toHaveBeenCalled();
  });

  it('paiement du conducteur : libère ses fonds', async () => {
    const { service, wallets } = build();
    await resolve(service, { type: DisputeResolutionType.DRIVER_PAYOUT });
    expect(wallets.releaseHeldFunds).toHaveBeenCalledWith({ driverId: 'dr1', bookingId: 'b1' });
  });

  it('annulation : réservation annulée et places rendues une seule fois', async () => {
    const { service, tx } = build();
    await resolve(service, { type: DisputeResolutionType.CANCELLATION, notes: 'Annulation décidée par le support' });
    expect(tx.booking.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'b1', status: { notIn: [BookingStatus.CANCELLED, BookingStatus.REFUNDED] } } }),
    );
    expect(tx.trip.update).toHaveBeenCalled();
  });

  it('annulation déjà faite par ailleurs : aucune place rendue une seconde fois', async () => {
    const { service, tx } = build({ claimCount: 0 });
    await resolve(service, { type: DisputeResolutionType.CANCELLATION, notes: 'Annulation décidée par le support' });
    expect(tx.trip.update).not.toHaveBeenCalled();
  });
});
