// backend/src/pricing/pricing.service.ts
// [21/09/2026] v2 — devis d'envoi : poids volumétrique, valeur déclarée, distance routière ; repli sur les villes au lieu d'une distance de 0.
import { BadRequestException, Injectable } from '@nestjs/common';
import { ServiceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Calcul de commission partagé entre Trajets (Lot 3) et Envois (Lot 4) —
 * section 39 du cahier des charges. La gestion admin complète des
 * CommissionRule (CRUD, priorités d'affichage...) arrive au Lot 5 ; ce
 * service lit déjà la table directement, car le calcul est nécessaire
 * dès qu'une réservation existe, bien avant que l'écran d'administration
 * ne soit construit.
 *
 * Priorité de résolution : règle spécifique au pays > règle globale
 * (countryId = null) > aucune commission (0) si rien n'est configuré —
 * dans ce dernier cas, un signal d'alerte devrait être remonté en
 * production (à brancher sur le système d'observabilité du Lot 9).
 */
export interface ShipmentQuoteInput {
  weightKg: number;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  quantity?: number | null;
  /** Valeur déclarée, plus petite unité de la devise. */
  declaredValue?: bigint | null;
  isUrgent: boolean;
  categoryPriceMultiplier: number;
  senderLocationId: string;
  recipientLocationId: string;
}

export interface ShipmentQuote {
  /** Montant total payé par le client — un seul montant, sans frais ajoutés. */
  price: bigint;
  /** Distance retenue pour le calcul (à vol d'oiseau × coefficient routier), en km. */
  distanceKm: number;
  /** Poids facturé : le plus grand du poids réel et du poids volumétrique. */
  chargeableWeightKg: number;
  volumetricWeightKg: number | null;
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async computeCommission(params: {
    serviceType: ServiceType;
    countryId?: string | null;
    baseAmount: bigint;
  }): Promise<bigint> {
    const { serviceType, countryId, baseAmount } = params;

    const rule =
      (countryId &&
        (await this.prisma.commissionRule.findFirst({
          where: { serviceType, countryId, isActive: true },
        }))) ||
      (await this.prisma.commissionRule.findFirst({
        where: { serviceType, countryId: null, isActive: true },
      }));

    if (!rule) return 0n;

    let fee: bigint;
    if (rule.fixedAmount !== null && rule.fixedAmount !== undefined) {
      fee = rule.fixedAmount;
    } else if (rule.percentage !== null && rule.percentage !== undefined) {
      // Conversion via Number : sûre tant que baseAmount reste dans la
      // plage des entiers sûrs JS (2^53) — largement suffisant pour des
      // montants en GNF/XOF unitaires. À revoir si des montants massifs
      // (transferts B2B) apparaissent en Phase 3.
      fee = BigInt(Math.round(Number(baseAmount) * (rule.percentage / 100)));
    } else {
      fee = 0n;
    }

    if (rule.minAmount !== null && rule.minAmount !== undefined && fee < rule.minAmount) {
      fee = rule.minAmount;
    }
    if (rule.maxAmount !== null && rule.maxAmount !== undefined && fee > rule.maxAmount) {
      fee = rule.maxAmount;
    }

    return fee;
  }

  /**
   * Politique d'annulation applicable (section 26/63) — cherche une règle
   * spécifique au pays puis globale, même logique que les commissions.
   */
  async getCancellationPolicy(params: { serviceType: ServiceType; countryId?: string | null }) {
    const { serviceType, countryId } = params;
    return (
      (countryId &&
        (await this.prisma.cancellationPolicy.findFirst({
          where: { serviceType, countryId, isActive: true },
        }))) ||
      (await this.prisma.cancellationPolicy.findFirst({
        where: { serviceType, countryId: null, isActive: true },
      }))
    );
  }

  /**
   * Lecture d'un paramètre numérique configurable (Partie VII, table
   * PlatformSetting) avec repli sur une valeur par défaut si absent —
   * même pattern que TripsService.getSearchRadiusKm.
   */
  async getNumericSetting(key: string, defaultValue: number): Promise<number> {
    const setting = await this.prisma.platformSetting.findUnique({ where: { key } });
    const value = setting?.value;
    return typeof value === 'number' ? value : defaultValue;
  }

  /**
   * Moteur tarifaire des envois (section 40 : prix de base, poids,
   * distance, catégorie, urgence — volontairement séparé du reste du
   * système, comme demandé). Tous les taux sont configurables via
   * PlatformSetting ; les clés et valeurs par défaut ci-dessous ne sont
   * qu'un point de départ raisonnable tant qu'aucun SuperAdmin ne les a
   * ajustées.
   *
   * v2 — le devis tient aussi compte du volume (poids volumétrique : on
   * facture le plus grand du poids réel et du poids volumétrique), de la
   * valeur déclarée (frais de manutention/assurance) et de la distance par
   * la route (distance à vol d'oiseau × coefficient), en plus du poids, de
   * la catégorie et de l'urgence.
   *
   * Clés PlatformSetting (valeur par défaut entre parenthèses) :
   * shipment.base_price (2000), shipment.price_per_kg (1000),
   * shipment.price_per_km (300), shipment.urgent_surcharge (5000),
   * shipment.volumetric_divisor (5000, cm³ par kg),
   * shipment.road_distance_factor (1.3),
   * shipment.declared_value_rate_percent (1),
   * shipment.declared_value_min_fee (0).
   */
  async computeShipmentQuote(params: ShipmentQuoteInput): Promise<ShipmentQuote> {
    const [
      basePrice,
      perKgRate,
      perKmRate,
      urgentSurcharge,
      volumetricDivisor,
      roadDistanceFactor,
      declaredValueRatePercent,
      declaredValueMinFee,
    ] = await Promise.all([
      this.getNumericSetting('shipment.base_price', 2000),
      this.getNumericSetting('shipment.price_per_kg', 1000),
      this.getNumericSetting('shipment.price_per_km', 300),
      this.getNumericSetting('shipment.urgent_surcharge', 5000),
      this.getNumericSetting('shipment.volumetric_divisor', 5000),
      this.getNumericSetting('shipment.road_distance_factor', 1.3),
      this.getNumericSetting('shipment.declared_value_rate_percent', 1),
      this.getNumericSetting('shipment.declared_value_min_fee', 0),
    ]);

    const straightLineKm = await this.computeDistanceKm(params.senderLocationId, params.recipientLocationId);
    const distanceKm = straightLineKm * roadDistanceFactor;

    // Dimensions données par colis : le volume total est multiplié par la quantité.
    const quantity = Math.max(1, params.quantity ?? 1);
    const { lengthCm, widthCm, heightCm } = params;
    const volumetricWeightKg =
      lengthCm && widthCm && heightCm && volumetricDivisor > 0
        ? ((lengthCm * widthCm * heightCm) / volumetricDivisor) * quantity
        : null;
    const chargeableWeightKg = Math.max(params.weightKg, volumetricWeightKg ?? 0);

    let price = basePrice + perKgRate * chargeableWeightKg + perKmRate * distanceKm;
    price *= params.categoryPriceMultiplier;

    if (params.declaredValue && params.declaredValue > 0n) {
      const valueFee = (Number(params.declaredValue) * declaredValueRatePercent) / 100;
      price += Math.max(declaredValueMinFee, valueFee);
    }
    if (params.isUrgent) price += urgentSurcharge;

    return {
      price: BigInt(Math.round(price)),
      distanceKm: Math.round(distanceKm * 10) / 10,
      chargeableWeightKg: Math.round(chargeableWeightKg * 100) / 100,
      volumetricWeightKg: volumetricWeightKg === null ? null : Math.round(volumetricWeightKg * 100) / 100,
    };
  }

  /** Conservé pour les appelants qui n'ont besoin que du montant. */
  async computeShipmentPrice(params: ShipmentQuoteInput): Promise<bigint> {
    return (await this.computeShipmentQuote(params)).price;
  }

  /**
   * Distance à vol d'oiseau entre deux Location, via le point PostGIS. Si
   * l'une des deux n'est pas géocodée (adresse saisie à la main, section
   * 58), on se rabat sur la distance entre les centres de leurs villes ;
   * si même cela est impossible, on refuse plutôt que de facturer une
   * distance de zéro sans prévenir (ancien comportement : sous-facturation
   * silencieuse).
   */
  private async computeDistanceKm(senderLocationId: string, recipientLocationId: string): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ distanceMeters: number | null }[]>`
      SELECT ST_Distance(a."geoPoint", b."geoPoint") AS "distanceMeters"
      FROM locations a, locations b
      WHERE a.id = ${senderLocationId} AND b.id = ${recipientLocationId};
    `;
    const meters = rows[0]?.distanceMeters;
    if (meters !== null && meters !== undefined) return meters / 1000;

    const locations = await this.prisma.location.findMany({
      where: { id: { in: [senderLocationId, recipientLocationId] } },
      include: { city: true },
    });
    const from = this.pointOf(locations.find((location) => location.id === senderLocationId));
    const to = this.pointOf(locations.find((location) => location.id === recipientLocationId));
    if (!from || !to) {
      throw new BadRequestException(
        "Impossible de calculer la distance : choisissez une adresse localisée sur la carte ou une ville dont les coordonnées sont renseignées.",
      );
    }
    return this.haversineKm(from, to);
  }

  private pointOf(
    location:
      | {
          latitude: number | null;
          longitude: number | null;
          city: { latitude: number | null; longitude: number | null } | null;
        }
      | undefined,
  ): { latitude: number; longitude: number } | null {
    if (!location) return null;
    if (location.latitude !== null && location.longitude !== null) {
      return { latitude: location.latitude, longitude: location.longitude };
    }
    if (location.city && location.city.latitude !== null && location.city.longitude !== null) {
      return { latitude: location.city.latitude, longitude: location.city.longitude };
    }
    return null;
  }

  private haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(b.latitude - a.latitude);
    const dLon = toRad(b.longitude - a.longitude);
    const h =
      Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadiusKm * Math.asin(Math.sqrt(h));
  }
}