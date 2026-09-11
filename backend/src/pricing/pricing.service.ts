// backend/src/pricing/pricing.service.ts
import { Injectable } from '@nestjs/common';
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
   */
  async computeShipmentPrice(params: {
    weightKg: number;
    isUrgent: boolean;
    categoryPriceMultiplier: number;
    senderLocationId: string;
    recipientLocationId: string;
  }): Promise<bigint> {
    const [basePrice, perKgRate, perKmRate, urgentSurcharge] = await Promise.all([
      this.getNumericSetting('shipment.base_price', 2000),
      this.getNumericSetting('shipment.price_per_kg', 1000),
      this.getNumericSetting('shipment.price_per_km', 300),
      this.getNumericSetting('shipment.urgent_surcharge', 5000),
    ]);

    const distanceKm = await this.computeDistanceKm(
      params.senderLocationId,
      params.recipientLocationId,
    );

    let price = basePrice + perKgRate * params.weightKg + (distanceKm ?? 0) * perKmRate;
    price *= params.categoryPriceMultiplier;
    if (params.isUrgent) price += urgentSurcharge;

    return BigInt(Math.round(price));
  }

  /**
   * Distance à vol d'oiseau entre deux Location, via le point PostGIS —
   * `null` si l'une des deux localisations n'a pas de coordonnées
   * géocodées (adresse saisie manuellement sans géocodage, section 58).
   */
  private async computeDistanceKm(
    senderLocationId: string,
    recipientLocationId: string,
  ): Promise<number | null> {
    const rows = await this.prisma.$queryRaw<{ distanceMeters: number | null }[]>`
      SELECT ST_Distance(a."geoPoint", b."geoPoint") AS "distanceMeters"
      FROM locations a, locations b
      WHERE a.id = ${senderLocationId} AND b.id = ${recipientLocationId};
    `;
    const meters = rows[0]?.distanceMeters;
    return meters !== null && meters !== undefined ? meters / 1000 : null;
  }
}
