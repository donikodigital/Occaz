// backend/src/trips/trip-route.planner.ts
//
// Partie « base de données » du calcul de route : distances entre adresses (PostGIS, via PricingService), réglages
// configurables, et fabrication des lignes d'étapes (distance, prix automatique, heure de passage). Les règles pures
// (prix d'un tronçon, correspondance de villes, arrondis) sont dans trip-route.ts.
import { BadRequestException } from '@nestjs/common';
import { PricingService } from '../pricing/pricing.service';
import {
  computeAutoFares,
  estimateArrivalAt,
  interpolateFare,
  validateStopFare,
  buildRoute,
  type RouteStopInput,
} from './trip-route';

export interface RouteSettings {
  /** Les prix des étapes sont arrondis à ce multiple (500 par défaut). */
  roundingStep: number;
  /** Plancher du prix d'un tronçon (500 par défaut) : un tronçon très court ne coûte jamais quasi rien. */
  minSegmentPrice: bigint;
  averageSpeedKmh: number;
  roadDistanceFactor: number;
}

/** Réglages modifiables par le SuperAdmin (PlatformSetting) ; les valeurs par défaut conviennent pour démarrer. */
export async function loadRouteSettings(pricing: PricingService): Promise<RouteSettings> {
  const [roundingStep, minSegmentPrice, averageSpeedKmh, roadDistanceFactor] = await Promise.all([
    pricing.getNumericSetting('trip.segment_price_rounding', 500),
    pricing.getNumericSetting('trip.segment_min_price', 500),
    pricing.getNumericSetting('trip.average_speed_kmh', 55),
    pricing.getNumericSetting('trip.road_distance_factor', 1.3),
  ]);
  return {
    roundingStep: roundingStep >= 1 ? roundingStep : 500,
    minSegmentPrice: BigInt(Math.max(1, Math.round(minSegmentPrice))),
    averageSpeedKmh: averageSpeedKmh > 0 ? averageSpeedKmh : 55,
    roadDistanceFactor: roadDistanceFactor > 0 ? roadDistanceFactor : 1.3,
  };
}

export interface PlannedStopInput {
  locationId: string;
  cityId: string;
  /** Prix depuis le départ saisi par le conducteur ; absent = calculé automatiquement. */
  fareFromOrigin?: bigint;
  estimatedArrivalAt?: Date;
  isBookable?: boolean;
}

export interface PlannedStopRow {
  locationId: string;
  cityId: string;
  sequence: number;
  distanceFromOriginKm: number | null;
  fareFromOrigin: bigint;
  estimatedArrivalAt: Date | null;
  isBookable: boolean;
}

export class TripRoutePlanner {
  constructor(private readonly pricing: PricingService) {}

  /**
   * Distance cumulée du départ à chaque étape puis à l'arrivée, en suivant l'ordre des étapes. Renvoie null si une
   * distance manque (adresse sans coordonnées) : l'appelant répartit alors à égale distance.
   */
  async computeGeometry(
    originLocationId: string,
    stopLocationIds: string[],
    destinationLocationId: string,
  ): Promise<{ cumulativeKm: number[]; totalKm: number } | null> {
    const chain = [originLocationId, ...stopLocationIds, destinationLocationId];
    const hops = await Promise.all(
      chain.slice(0, -1).map((from, index) => this.pricing.distanceKmBetweenLocations(from, chain[index + 1])),
    );
    if (hops.some((hop) => hop === null)) return null;

    let cumulative = 0;
    const cumulativeKm: number[] = [];
    hops.forEach((hop, index) => {
      cumulative += hop as number;
      if (index < stopLocationIds.length) cumulativeKm.push(round1(cumulative));
    });
    return { cumulativeKm, totalKm: round1(cumulative) };
  }

  /**
   * Lignes d'étapes prêtes à être enregistrées : numérotées 1..n dans l'ordre reçu, avec distance, prix (automatique
   * au prorata de la distance, sauf prix saisi par le conducteur) et heure de passage estimée.
   */
  async planStops(params: {
    departureAt: Date;
    pricePerSeat: bigint;
    originLocationId: string;
    destinationLocationId: string;
    stops: PlannedStopInput[];
  }): Promise<PlannedStopRow[]> {
    if (params.stops.length === 0) return [];

    const [settings, geometry] = await Promise.all([
      loadRouteSettings(this.pricing),
      this.computeGeometry(
        params.originLocationId,
        params.stops.map((stop) => stop.locationId),
        params.destinationLocationId,
      ),
    ]);

    const autoFares = computeAutoFares(
      params.pricePerSeat,
      geometry ? geometry.cumulativeKm : params.stops.map(() => 0),
      geometry ? geometry.totalKm : 0,
      settings.roundingStep,
    );

    const rows = params.stops.map<PlannedStopRow>((stop, index) => {
      const distance = geometry ? geometry.cumulativeKm[index] : null;
      return {
        locationId: stop.locationId,
        cityId: stop.cityId,
        sequence: index + 1,
        distanceFromOriginKm: distance,
        fareFromOrigin: stop.fareFromOrigin ?? autoFares[index],
        estimatedArrivalAt:
          stop.estimatedArrivalAt ??
          (distance !== null
            ? estimateArrivalAt(params.departureAt, distance, settings.roadDistanceFactor, settings.averageSpeedKmh)
            : null),
        isBookable: stop.isBookable ?? true,
      };
    });

    // Les prix saisis à la main doivent rester croissants et ne pas dépasser le prix du trajet.
    let previous = 0n;
    for (const row of rows) {
      if (row.fareFromOrigin < previous || row.fareFromOrigin > params.pricePerSeat) {
        throw new BadRequestException(
          "Les prix des étapes doivent aller en croissant depuis le départ et ne pas dépasser le prix du trajet.",
        );
      }
      previous = row.fareFromOrigin;
    }
    return rows;
  }

  /** Prix proposé pour une étape insérée entre deux points existants (au prorata de la distance entre ses voisins). */
  interpolateInsertedFare(params: {
    previousFare: bigint;
    nextFare: bigint;
    previousKm: number | null;
    nextKm: number | null;
    thisKm: number | null;
    roundingStep: number;
  }): bigint {
    if (params.previousKm === null || params.nextKm === null || params.thisKm === null) {
      return interpolateFare(params.previousFare, params.nextFare, 0, 2, 1, params.roundingStep);
    }
    return interpolateFare(
      params.previousFare,
      params.nextFare,
      params.previousKm,
      params.nextKm,
      params.thisKm,
      params.roundingStep,
    );
  }

  /** Vérifie qu'un prix saisi pour une étape reste entre ceux de ses voisins ; lève une 400 lisible sinon. */
  assertFareWithinNeighbours(
    trip: {
      pricePerSeat: bigint;
      departureAt: Date;
      originCityId: string;
      originLocationId: string;
      destinationCityId: string;
      destinationLocationId: string;
      stops: RouteStopInput[];
    },
    stopId: string,
    newFare: bigint,
  ): void {
    const verdict = validateStopFare(buildRoute(trip), stopId, newFare);
    if (!verdict.ok) {
      throw new BadRequestException(
        `Le prix de cette étape doit être compris entre ${verdict.min} et ${verdict.max} (prix des étapes voisines).`,
      );
    }
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
