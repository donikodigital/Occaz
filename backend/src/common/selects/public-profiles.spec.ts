// backend/src/common/selects/public-profiles.spec.ts
// Garde-fou de confidentialité : les champs privés d'un profil ne doivent jamais sortir vers l'autre partie d'un trajet ou d'une réservation,
// ni par les sélections publiques, ni par un retour en arrière vers `driver: true` / `customer: true` dans les services concernés.
import { readFileSync } from 'fs';
import { join } from 'path';
import { PUBLIC_CUSTOMER_SELECT, PUBLIC_DRIVER_SELECT } from './public-profiles';

const PRIVATE_DRIVER_FIELDS = ['dateOfBirth', 'mobileMoneyNumber', 'bankAccountRef', 'userId', 'countryId', 'cityId'];
const PRIVATE_CUSTOMER_FIELDS = ['dateOfBirth', 'address', 'countryId', 'cityId'];

describe('sélections publiques des profils', () => {
  it.each(PRIVATE_DRIVER_FIELDS)('le conducteur public n’expose pas %s', (field) => {
    expect(Object.keys(PUBLIC_DRIVER_SELECT)).not.toContain(field);
  });

  it.each(PRIVATE_CUSTOMER_FIELDS)('le client public n’expose pas %s', (field) => {
    expect(Object.keys(PUBLIC_CUSTOMER_SELECT)).not.toContain(field);
  });

  it('garde les champs que les écrans affichent', () => {
    expect(Object.keys(PUBLIC_DRIVER_SELECT)).toEqual(
      expect.arrayContaining(['id', 'firstName', 'lastName', 'photoUrl', 'averageRating', 'isVerifiedBadge', 'completedTripsCount']),
    );
    expect(Object.keys(PUBLIC_CUSTOMER_SELECT)).toEqual(expect.arrayContaining(['id', 'userId', 'firstName', 'lastName']));
  });
});

describe('services qui répondent aux utilisateurs : jamais le profil entier', () => {
  const files = ['trips/trips.service.ts', 'trips/bookings.service.ts', 'dashboards/customer-dashboard.service.ts'];

  it.each(files)('%s n’inclut plus driver: true / customer: true', (file) => {
    const source = readFileSync(join(__dirname, '..', '..', file), 'utf8');
    const offending = source
      .split('\n')
      .map((line, index) => ({ line, number: index + 1 }))
      .filter(({ line }) => /\b(driver|customer):\s*true\b/.test(line) && !line.trim().startsWith('//') && !line.trim().startsWith('*'));
    expect(offending).toEqual([]);
  });
});
