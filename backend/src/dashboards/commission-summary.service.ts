// backend/src/dashboards/commission-summary.service.ts
import { Injectable } from '@nestjs/common';
import { BookingStatus, ShipmentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { CommissionSummaryPeriod } from './dto/commission-summary-query.dto';

interface PeriodWindow {
  start: Date;
  end: Date;
}

interface CommissionFigures {
  from: string;
  to: string;
  bookingCommission: string;
  shipmentCommission: string;
  totalCommission: string;
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
 */
@Injectable()
export class CommissionSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(period: CommissionSummaryPeriod): Promise<CommissionSummaryResult> {
    const now = new Date();
    const current = this.windowFor(period, now);
    const previous = this.previousWindowFor(period, current.start);

    const [currentFigures, previousFigures] = await Promise.all([
      this.figuresFor(current),
      this.figuresFor(previous),
    ]);

    return { period, current: currentFigures, previous: previousFigures };
  }

  private async figuresFor(window: PeriodWindow): Promise<CommissionFigures> {
    const [bookingAgg, shipmentAgg] = await Promise.all([
      this.prisma.booking.aggregate({
        where: {
          status: { in: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED] },
          createdAt: { gte: window.start, lt: window.end },
        },
        _sum: { platformFee: true },
      }),
      this.prisma.shipment.aggregate({
        where: {
          status: { notIn: [ShipmentStatus.CREATED, ShipmentStatus.CANCELLED] },
          createdAt: { gte: window.start, lt: window.end },
        },
        _sum: { platformFee: true },
      }),
    ]);

    const bookingCommission = bookingAgg._sum.platformFee ?? 0n;
    const shipmentCommission = shipmentAgg._sum.platformFee ?? 0n;

    return {
      from: window.start.toISOString(),
      to: window.end.toISOString(),
      bookingCommission: bookingCommission.toString(),
      shipmentCommission: shipmentCommission.toString(),
      totalCommission: (bookingCommission + shipmentCommission).toString(),
    };
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