// backend/src/common/safety/simulation-guard.spec.ts
import { ServiceUnavailableException } from '@nestjs/common';
import { assertSimulationAllowed, isSimulationAllowed } from './simulation-guard';

describe('simulation-guard', () => {
  it('hors production : toujours autorisée', () => {
    expect(isSimulationAllowed({ NODE_ENV: 'development' })).toBe(true);
    expect(isSimulationAllowed({ NODE_ENV: 'test' })).toBe(true);
    expect(isSimulationAllowed({})).toBe(true);
  });
  it('en production : refusée par défaut, autorisée seulement avec ALLOW_SIMULATED_PAYMENTS=true', () => {
    expect(isSimulationAllowed({ NODE_ENV: 'production' })).toBe(false);
    expect(isSimulationAllowed({ NODE_ENV: 'production', ALLOW_SIMULATED_PAYMENTS: 'false' })).toBe(false);
    expect(isSimulationAllowed({ NODE_ENV: 'production', ALLOW_SIMULATED_PAYMENTS: 'true' })).toBe(true);
  });
  it('assertSimulationAllowed : 503 en production sans autorisation', () => {
    expect(() => assertSimulationAllowed('Le paiement en ligne', { NODE_ENV: 'production' })).toThrow(ServiceUnavailableException);
    expect(() => assertSimulationAllowed('Le paiement en ligne', { NODE_ENV: 'production', ALLOW_SIMULATED_PAYMENTS: 'true' })).not.toThrow();
  });
});
