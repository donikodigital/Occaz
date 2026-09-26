// backend/src/dashboards/commission-summary.service.ts
import { Injectable } from '@nestjs/common';
import { BookingStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommissionSummaryPeriod } from './dto/commission-summary-query.dto';

interface PeriodWindow {
  start: Date;
  end: Date;
}

interface CommissionFiguresByCurrency {
  currencyId: string;
  isoCode: string;
  bookingCommission: string;
  shipmentCommission: string;
  totalCommission: string;
}

interface CommissionFigures {
  from: string;
  to: string;
  byCurrency: CommissionFiguresByCurrency[];
}

export interface CommissionSummaryResult {
  period: CommissionSummaryPeriod;
  current: CommissionFigures;
  previous: CommissionFigures;
}

/**
 * Filtre les commissions par période préréglée (semaine/mois/trimestre/
 * année), avec comparaison à la période précédente équivalente — fichier
 * isolé plutôt que d'ajouter cette logique à AdminDashboardService, pour
 * ne pas modifier un service existant (convention projet). getOverview()
 * reste la source du cumul total depuis le début ; ceci ne couvre qu'une
 * fenêtre glissante.
 *
 * Une commission est toujours regroupée par devise, jamais additionnée
 * entre devises différentes (1 GNF ≠ 1 XOF) — même principe que
 * ExchangeRateService. Toutes les devises actives apparaissent dans le
 * résultat, même à 0, pour que l'admin voie que le XOF est bien suivi
 * dès qu'un trajet transfrontalier existe, pas seulement une fois qu'il
 * y a du volume.
 */
@Injectable()
export class CommissionSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(period: CommissionSummaryPeriod): Promise<CommissionSummaryResult> {
    const now = new Date();
    const current = this.windowFor(period, now);
    const previous = this.previousWindowFor(period, current.start);

    const currencies = await this.prisma.currency.findMany();

    const [currentFigures, previousFigures] = await Promise.all([
      this.figuresFor(current, currencies),
      this.figuresFor(previous, currencies),
    ]);

    return { period, current: currentFigures, previous: previousFigures };
  }

  private async figuresFor(
    window: PeriodWindow,
    currencies: { id: string; isoCode: string }[],
  ): Promise<CommissionFigures> {
    const [bookingsByCurrency, shipmentsByCurrency] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['currencyId'],
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          createdAt: { gte: window.start, lt: window.end },
        },
        _sum: { platformFee: true },
      }),
      this.prisma.shipment.groupBy({
        by: ['currencyId'],
        where: {
          status: { notIn: [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED] },
          createdAt: { gte: window.start, lt: window.end },
        },
        _sum: { platformFee: true },
      }),
    ]);

    type GroupedFeeRow = { currencyId: string; _sum: { platformFee: bigint | null } };
    const bookingByCurrencyId = new Map<string, bigint>(
      (bookingsByCurrency as GroupedFeeRow[]).map((row) => [row.currencyId, row._sum.platformFee ?? 0n]),
    );
    const shipmentByCurrencyId = new Map<string, bigint>(
      (shipmentsByCurrency as GroupedFeeRow[]).map((row) => [row.currencyId, row._sum.platformFee ?? 0n]),
    );

    const byCurrency: CommissionFiguresByCurrency[] = currencies.map((currency) => {
      const bookingCommission = bookingByCurrencyId.get(currency.id) ?? 0n;
      const shipmentCommission = shipmentByCurrencyId.get(currency.id) ?? 0n;
      return {
        currencyId: currency.id,
        isoCode: currency.isoCode,
        bookingCommission: bookingCommission.toString(),
        shipmentCommission: shipmentCommission.toString(),
        totalCommission: (bookingCommission + shipmentCommission).toString(),
      };
    });

    return { from: window.start.toISOString(), to: window.end.toISOString(), byCurrency };
  }

  /** Début de la période courante (minuit, heure serveur) jusqu'à maintenant. */
  private windowFor(period: CommissionSummaryPeriod, now: Date): PeriodWindow {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    switch (period) {
      case 'week': {
        // Semaine calée sur lundi (getDay(): 0=dimanche...6=samedi).
        const day = start.getDay();
        const diffToMonday = day === 0 ? 6 : day - 1;
        start.setDate(start.getDate() - diffToMonday);
        break;
      }
      case 'month':
        start.setDate(1);
        break;
      case 'quarter': {
        const quarterStartMonth = Math.floor(start.getMonth() / 3) * 3;
        start.setMonth(quarterStartMonth, 1);
        break;
      }
      case 'year':
        start.setMonth(0, 1);
        break;
    }

    return { start, end: now };
  }

  /** Même durée que la période courante, placée juste avant son début — sert de comparaison ("X le mois précédent"). */
  private previousWindowFor(period: CommissionSummaryPeriod, currentStart: Date): PeriodWindow {
    const end = new Date(currentStart);
    const start = new Date(currentStart);

    switch (period) {
      case 'week':
        start.setDate(start.getDate() - 7);
        break;
      case 'month':
        start.setMonth(start.getMonth() - 1);
        break;
      case 'quarter':
        start.setMonth(start.getMonth() - 3);
        break;
      case 'year':
        start.setFullYear(start.getFullYear() - 1);
        break;
    }

    return { start, end };
  }
}