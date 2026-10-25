// backend/src/payment-providers/payment-providers.controller.spec.ts
// Les réglages techniques (config) d'un prestataire ne sortent que pour la gestion des moyens de paiement.
import { PERMISSIONS } from '../common/constants/permissions.constants';
import { PaymentProvidersController, withoutConfig } from './payment-providers.controller';

const row = { id: 'p1', name: 'Orange Money', isActive: true, config: { apiKey: 'secret' } };

function build() {
  const service = {
    findOne: jest.fn().mockResolvedValue(row),
    findAllActiveForCountry: jest.fn().mockResolvedValue([row]),
  };
  return { controller: new PaymentProvidersController(service as never), service };
}

describe('PaymentProvidersController — config masquée', () => {
  it('withoutConfig retire config et garde le reste', () => {
    expect(withoutConfig(row)).toEqual({ id: 'p1', name: 'Orange Money', isActive: true });
  });

  it('la liste publique /active ne contient jamais config', async () => {
    const { controller } = build();
    const result = await controller.findAllActive('GN');
    expect(result[0]).not.toHaveProperty('config');
  });

  it('GET /:id masque config pour un utilisateur ordinaire', async () => {
    const { controller } = build();
    const result = await controller.findOne('p1', { permissions: [] } as never);
    expect(result).not.toHaveProperty('config');
  });

  it('GET /:id garde config pour la gestion des moyens de paiement', async () => {
    const { controller } = build();
    const result = await controller.findOne('p1', { permissions: [PERMISSIONS.PAYMENT_PROVIDER_MANAGE] } as never);
    expect(result).toHaveProperty('config');
  });
});
