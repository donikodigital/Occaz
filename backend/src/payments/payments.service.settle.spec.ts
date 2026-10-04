// backend/src/payments/payments.service.settle.spec.ts
// Règlement des paiements : webhook rejoué, échec tardif, paiement après annulation, reprise après erreur.
import { PaymentProviderType, PaymentStatus, ShipmentStatus } from '@prisma/client';
import { PaymentsService } from './payments.service';

type Tx = { id: string; paymentId: string; status: PaymentStatus };

function build(options: {
  transaction?: Partial<Tx>;
  claimTransaction?: number;
  claimPayment?: number;
  confirmOutcome?: 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'NOT_PAYABLE';
  holdFails?: boolean;
  shipmentStatus?: ShipmentStatus;
  paymentOf?: 'booking' | 'shipment';
  bookingAmounts?: { totalAmount: bigint; platformFee: bigint };
} = {}) {
  const transaction: Tx = { id: 'tx1', paymentId: 'pay1', status: PaymentStatus.PENDING, ...options.transaction };
  const payment =
    options.paymentOf === 'shipment'
      ? { id: 'pay1', bookingId: null, shipmentId: 's1', status: PaymentStatus.CAPTURED }
      : { id: 'pay1', bookingId: 'b1', shipmentId: null, status: PaymentStatus.CAPTURED };
  const booking = {
    id: 'b1',
    totalAmount: options.bookingAmounts?.totalAmount ?? 115_000n,
    platformFee: options.bookingAmounts?.platformFee ?? 15_000n,
    currencyId: 'GNF',
    seatsCount: 1,
    customer: { userId: 'uc' },
    trip: { id: 't1', driverId: 'dr1', driver: { userId: 'ud' }, originCity: { name: 'A' }, destinationCity: { name: 'B' } },
  };
  const shipment = {
    id: 's1',
    status: options.shipmentStatus ?? ShipmentStatus.CREATED,
    driverId: null,
    customer: { userId: 'uc' },
    totalAmount: 150_000n,
    platformFee: 15_000n,
    currencyId: 'GNF',
  };
  const prisma = {
    paymentTransaction: {
      findFirst: jest.fn().mockResolvedValue(transaction),
      updateMany: jest.fn().mockResolvedValue({ count: options.claimTransaction ?? 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    payment: {
      updateMany: jest.fn().mockResolvedValue({ count: options.claimPayment ?? 1 }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(payment),
      update: jest.fn().mockResolvedValue({}),
    },
    booking: { findUniqueOrThrow: jest.fn().mockResolvedValue(booking) },
    shipment: { findUniqueOrThrow: jest.fn().mockResolvedValue(shipment) },
  };
  const wallets = {
    holdBookingRevenue: options.holdFails
      ? jest.fn().mockRejectedValue(new Error('portefeuille indisponible'))
      : jest.fn().mockResolvedValue(undefined),
    holdShipmentRevenue: jest.fn().mockResolvedValue(undefined),
  };
  const bookingsService = { confirmPayment: jest.fn().mockResolvedValue(options.confirmOutcome ?? 'CONFIRMED') };
  const shipmentsService = { confirmPayment: jest.fn().mockResolvedValue(undefined) };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined) };
  const referrals = { handleFirstPaymentConfirmed: jest.fn().mockResolvedValue(undefined) };
  const service = new PaymentsService(
    prisma as never,
    {} as never,
    {} as never,
    wallets as never,
    bookingsService as never,
    shipmentsService as never,
    notifications as never,
    referrals as never,
  );
  const refundBooking = jest.spyOn(service, 'refundBooking').mockResolvedValue(undefined);
  const refundShipment = jest.spyOn(service, 'refundShipment').mockResolvedValue(undefined);
  return { service, prisma, wallets, bookingsService, shipmentsService, refundBooking, refundShipment };
}

const settle = (service: PaymentsService, status: 'CAPTURED' | 'FAILED') =>
  service.handleWebhook(PaymentProviderType.ORANGE_MONEY, { externalReference: 'ref', status }, {});
// handleWebhook délègue l'authentification à l'adaptateur : on court-circuite le registre pour tester le règlement seul.
function withAdapter(service: PaymentsService, status: 'CAPTURED' | 'FAILED') {
  (service as unknown as { registry: unknown }).registry = {
    resolve: () => ({ verifyAndParseWebhook: async () => ({ externalReference: 'ref', status }) }),
  };
  return settle(service, status);
}

describe('PaymentsService — règlement des paiements', () => {
  it('capture : crédite le chauffeur une fois, confirme la réservation', async () => {
    const { service, wallets, bookingsService } = build();
    await expect(withAdapter(service, 'CAPTURED')).resolves.toEqual({ paymentId: 'pay1', status: PaymentStatus.CAPTURED });
    expect(bookingsService.confirmPayment).toHaveBeenCalledWith('b1');
    expect(wallets.holdBookingRevenue).toHaveBeenCalledTimes(1);
  });

  it('webhook rejoué (transaction déjà capturée) : ne retraite rien', async () => {
    const { service, wallets, prisma } = build({ transaction: { status: PaymentStatus.CAPTURED } });
    await withAdapter(service, 'CAPTURED');
    expect(prisma.paymentTransaction.updateMany).not.toHaveBeenCalled();
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('deux webhooks simultanés : seul celui qui réclame la capture crédite le chauffeur', async () => {
    const { service, wallets } = build({ claimTransaction: 0 });
    await withAdapter(service, 'CAPTURED');
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('paiement déjà capturé par une autre tentative : pas de second crédit', async () => {
    const { service, wallets } = build({ claimPayment: 0 });
    await withAdapter(service, 'CAPTURED');
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('un échec tardif n\'écrase jamais un paiement déjà capturé', async () => {
    const { service, prisma } = build();
    await withAdapter(service, 'FAILED');
    expect(prisma.payment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { notIn: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED] },
        }),
      }),
    );
  });

  it('paiement arrivé après annulation de la réservation : remboursement intégral, chauffeur non crédité', async () => {
    const { service, wallets, refundBooking } = build({ confirmOutcome: 'NOT_PAYABLE' });
    await withAdapter(service, 'CAPTURED');
    expect(refundBooking).toHaveBeenCalledWith('b1', 100);
    expect(wallets.holdBookingRevenue).not.toHaveBeenCalled();
  });

  it('paiement arrivé après annulation de l\'envoi : remboursement intégral', async () => {
    const { service, shipmentsService, refundShipment } = build({
      paymentOf: 'shipment',
      shipmentStatus: ShipmentStatus.CANCELLED,
    });
    await withAdapter(service, 'CAPTURED');
    expect(refundShipment).toHaveBeenCalledWith('s1', 100);
    expect(shipmentsService.confirmPayment).not.toHaveBeenCalled();
  });

  it('si le crédit du chauffeur échoue, la transaction repasse en attente pour que le webhook rejoué la reprenne', async () => {
    const { service, prisma } = build({ holdFails: true });
    await expect(withAdapter(service, 'CAPTURED')).rejects.toThrow('portefeuille indisponible');
    expect(prisma.paymentTransaction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: PaymentStatus.PENDING } }),
    );
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: PaymentStatus.PENDING } }));
  });

  describe('gain du chauffeur sur un trajet : toujours son prix, promo ou non', () => {
    // prix du chauffeur = 100 000 ; la commission est payée EN PLUS par le client et un rabais ne réduit qu'elle.
    const cases: Array<[string, bigint, bigint]> = [
      ['sans promo', 115_000n, 15_000n],
      ['promo de 10 000 sur la commission', 105_000n, 5_000n],
      ['promo qui annule toute la commission', 100_000n, 0n],
    ];

    it.each(cases)('%s : le chauffeur touche 100 000', async (_label, totalAmount, platformFee) => {
      const { service, wallets } = build({ bookingAmounts: { totalAmount, platformFee } });
      await withAdapter(service, 'CAPTURED');

      const call = wallets.holdBookingRevenue.mock.calls[0][0];
      expect(call.grossAmount).toBe(totalAmount);
      expect(call.commission).toBe(platformFee);
      expect(call.grossAmount - call.commission).toBe(100_000n);
    });
  });
});
