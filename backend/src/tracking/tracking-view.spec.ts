// backend/src/tracking/tracking-view.spec.ts
import {
  approximateCoordinate,
  buildJourney,
  buildProgress,
  eventLabel,
  freshTripPosition,
  headlineFor,
  normalizeTrackingNumber,
  outcomeOf,
  progressIndex,
  whereIsParcel,
  type JourneyInputPoint,
} from './tracking-view';

const T = (hour: number) => new Date(`2026-10-10T${String(hour).padStart(2, '0')}:00:00Z`);

describe('normalizeTrackingNumber', () => {
  it.each([
    ['OCZ7F3A91C2B0', 'OCZ7F3A91C2B0'],
    ['ocz7f3a91c2b0', 'OCZ7F3A91C2B0'],
    ['OCZ 7F3A 91C2 B0', 'OCZ7F3A91C2B0'],
    ['  OCZ7F3A91C2B0-02 ', 'OCZ7F3A91C2B0'],
    ['OCZ7F3A91C2B0-12', 'OCZ7F3A91C2B0'],
  ])('lit %p', (input, expected) => {
    expect(normalizeTrackingNumber(input)).toBe(expected);
  });

  it.each(['', '   ', 'ABC123', 'OCZ7F3A91C2', 'OCZ7F3A91C2B0Z', 'OCZZZZZZZZZZZ', 'OCZ-7F3A91C2', "OCZ7F3A91C2B0'; DROP TABLE shipments;--"])(
    'refuse %p',
    (input) => {
      expect(normalizeTrackingNumber(input)).toBeNull();
    },
  );

  it('refuse null et undefined', () => {
    expect(normalizeTrackingNumber(null)).toBeNull();
    expect(normalizeTrackingNumber(undefined)).toBeNull();
  });
});

describe('étapes', () => {
  it('place chaque statut sur la bonne étape', () => {
    expect(progressIndex('SEARCHING_DRIVER')).toBe(0);
    expect(progressIndex('DRIVER_ASSIGNED')).toBe(1);
    expect(progressIndex('PICKUP_PENDING')).toBe(1);
    expect(progressIndex('PICKED_UP')).toBe(2);
    expect(progressIndex('IN_TRANSIT')).toBe(3);
    expect(progressIndex('DELIVERY_PENDING')).toBe(3);
    expect(progressIndex('COMPLETED')).toBe(4);
  });

  it('marque les étapes passées, l\'étape en cours et les suivantes', () => {
    expect(buildProgress('PICKED_UP').map((step) => step.state)).toEqual(['DONE', 'DONE', 'CURRENT', 'TODO', 'TODO']);
  });

  it('une fois livré, toutes les étapes sont passées', () => {
    expect(buildProgress('DELIVERED').every((step) => step.state === 'DONE')).toBe(true);
    expect(buildProgress('COMPLETED').every((step) => step.state === 'DONE')).toBe(true);
  });

  it('distingue livré, annulé et incident', () => {
    expect(outcomeOf('COMPLETED')).toBe('DELIVERED');
    expect(outcomeOf('REFUNDED')).toBe('CANCELLED');
    expect(outcomeOf('DISPUTED')).toBe('INCIDENT');
    expect(outcomeOf('IN_TRANSIT')).toBe('ACTIVE');
  });
});

describe('buildJourney', () => {
  const points = (reachedKindia: Date | null, reachedMamou: Date | null): JourneyInputPoint[] => [
    { cityName: 'Conakry', kind: 'PICKUP', reachedAt: null },
    { cityName: 'Kindia', kind: 'STOP', reachedAt: reachedKindia },
    { cityName: 'Mamou', kind: 'STOP', reachedAt: reachedMamou },
    { cityName: 'Labé', kind: 'DELIVERY', reachedAt: null },
  ];

  it('avant la prise en charge : le ramassage est la prochaine étape, le reste à venir', () => {
    const journey = buildJourney(points(null, null), 'DRIVER_ASSIGNED', null, null);
    expect(journey.map((point) => point.state)).toEqual(['NEXT', 'TODO', 'TODO', 'TODO']);
  });

  it('après la prise en charge : le ramassage est passé, la première ville traversée est la prochaine', () => {
    const journey = buildJourney(points(null, null), 'IN_TRANSIT', T(8), null);
    expect(journey.map((point) => point.state)).toEqual(['DONE', 'NEXT', 'TODO', 'TODO']);
    expect(journey[0].at).toEqual(T(8));
  });

  it('suit le conducteur de ville en ville', () => {
    const journey = buildJourney(points(T(10), null), 'IN_TRANSIT', T(8), null);
    expect(journey.map((point) => point.state)).toEqual(['DONE', 'DONE', 'NEXT', 'TODO']);
    expect(journey[1].at).toEqual(T(10));
  });

  it('une ville dont le signal a été oublié est passée si une ville après elle l\'est', () => {
    const journey = buildJourney(points(null, T(12)), 'IN_TRANSIT', T(8), null);
    expect(journey.map((point) => point.state)).toEqual(['DONE', 'DONE', 'DONE', 'NEXT']);
    expect(journey[1].at).toBeNull();
  });

  it('livré : toute la route est passée et plus rien n\'est « prochain »', () => {
    const journey = buildJourney(points(T(10), T(12)), 'COMPLETED', T(8), T(15));
    expect(journey.every((point) => point.state === 'DONE')).toBe(true);
    expect(journey[3].at).toEqual(T(15));
  });

  it('annulé : aucune étape « prochaine »', () => {
    const journey = buildJourney(points(null, null), 'CANCELLED', null, null);
    expect(journey.some((point) => point.state === 'NEXT')).toBe(false);
  });

  it('sans ville traversée : ramassage puis livraison', () => {
    const journey = buildJourney(
      [
        { cityName: 'Conakry', kind: 'PICKUP', reachedAt: null },
        { cityName: 'Labé', kind: 'DELIVERY', reachedAt: null },
      ],
      'PICKED_UP',
      T(8),
      null,
    );
    expect(journey.map((point) => point.state)).toEqual(['DONE', 'NEXT']);
  });
});

describe('position', () => {
  const NOW = T(12);

  it('arrondit à ~5 km', () => {
    expect(approximateCoordinate(10.1234)).toBe(10.1);
    expect(approximateCoordinate(-12.5678)).toBe(-12.55);
    expect(approximateCoordinate(9.6412)).toBe(9.65);
  });

  it('ne garde une position GPS que si elle est assez récente', () => {
    const trip = { currentLatitude: 10.1, currentLongitude: -12.2, currentPositionUpdatedAt: T(11) };
    expect(freshTripPosition(trip, NOW, 2 * 3_600_000)).toMatchObject({ latitude: 10.1, longitude: -12.2 });
    expect(freshTripPosition(trip, NOW, 30 * 60_000)).toBeNull();
    expect(freshTripPosition({ ...trip, currentLatitude: null }, NOW, 3_600_000 * 24)).toBeNull();
    expect(freshTripPosition(null, NOW, 3_600_000)).toBeNull();
  });

  const journey = buildJourney(
    [
      { cityName: 'Conakry', kind: 'PICKUP', reachedAt: null },
      { cityName: 'Kindia', kind: 'STOP', reachedAt: T(10) },
      { cityName: 'Mamou', kind: 'STOP', reachedAt: null },
      { cityName: 'Labé', kind: 'DELIVERY', reachedAt: null },
    ],
    'IN_TRANSIT',
    T(8),
    null,
  );
  const gps = { latitude: 10.1234, longitude: -12.5678, updatedAt: T(11) };

  it('vue publique : coordonnées arrondies, signalées comme approximatives', () => {
    const where = whereIsParcel({ status: 'IN_TRANSIT', journey, gps, precise: false });
    expect(where).toMatchObject({ source: 'GPS', latitude: 10.1, longitude: -12.55, isApproximate: true, label: 'Entre Kindia et Mamou' });
  });

  it('vue de l\'expéditeur : coordonnées exactes', () => {
    const where = whereIsParcel({ status: 'IN_TRANSIT', journey, gps, precise: true });
    expect(where).toMatchObject({ latitude: 10.1234, longitude: -12.5678, isApproximate: false });
  });

  it('sans GPS : la position se déduit des villes traversées, sans coordonnées', () => {
    const where = whereIsParcel({ status: 'IN_TRANSIT', journey, gps: null, precise: true });
    expect(where).toMatchObject({ source: 'CITIES', latitude: null, longitude: null, label: 'Entre Kindia et Mamou' });
    expect(where.updatedAt).toEqual(T(10));
  });

  it('juste après la prise en charge : « parti de… »', () => {
    const fresh = buildJourney(
      [
        { cityName: 'Conakry', kind: 'PICKUP', reachedAt: null },
        { cityName: 'Kindia', kind: 'STOP', reachedAt: null },
        { cityName: 'Labé', kind: 'DELIVERY', reachedAt: null },
      ],
      'PICKED_UP',
      T(8),
      null,
    );
    expect(whereIsParcel({ status: 'PICKED_UP', journey: fresh, gps: null, precise: false }).label).toBe('Parti de Conakry, en route vers Kindia');
  });

  it.each([
    ['SEARCHING_DRIVER', 'Pas encore pris en charge'],
    ['PICKUP_PENDING', "En attente de récupération chez l'expéditeur"],
    ['COMPLETED', 'Livré au destinataire'],
    ['CANCELLED', 'Envoi annulé'],
    ['DISPUTED', 'Incident en cours de traitement'],
  ])('statut %s : pas de position, « %s »', (status, label) => {
    const where = whereIsParcel({ status, journey, gps, precise: true });
    expect(where).toMatchObject({ label, source: 'NONE', latitude: null, longitude: null });
  });
});

describe('textes', () => {
  const where = { label: 'Entre Kindia et Mamou', source: 'CITIES' as const, latitude: null, longitude: null, updatedAt: null, isApproximate: false };

  it('l\'en-tête cite le conducteur par son prénom seulement', () => {
    expect(headlineFor({ status: 'PICKED_UP', driverFirstName: 'Mamadou', deliveryCity: 'Labé', where })).toBe('Colis récupéré par Mamadou');
    expect(headlineFor({ status: 'IN_TRANSIT', driverFirstName: 'Mamadou', deliveryCity: 'Labé', where })).toBe('Entre Kindia et Mamou');
    expect(headlineFor({ status: 'COMPLETED', driverFirstName: null, deliveryCity: 'Labé', where })).toBe('Colis livré');
  });

  it('l\'historique cache les doublons et les notes internes', () => {
    const context = { pickupCity: 'Conakry', deliveryCity: 'Labé' };
    expect(eventLabel('CREATED', null, context)).toBeNull();
    expect(eventLabel('COMPLETED', null, context)).toBeNull();
    expect(eventLabel('PICKED_UP', null, context)).toBe('Colis récupéré à Conakry');
    expect(eventLabel('IN_TRANSIT', 'Passage à Kindia', context)).toBe('Passage à Kindia');
    // Une note libre (motif d'annulation, prolongation…) n'est jamais affichée au public.
    expect(eventLabel('CANCELLED', 'Le client a changé d\'avis : voici mon numéro 620000000', context)).toBe('Envoi annulé');
  });
});
