// web-admin/src/app/(app)/dashboard/page.tsx
'use client';

import React, { useMemo } from 'react';
import {
  IconAlertTriangle,
  IconCash,
  IconPackage,
  IconRoute,
  IconTrendingUp,
  IconUserCheck,
  IconUsers,
} from '@tabler/icons-react';
import { StatCard } from '@/components/layout/StatCard';
import { Card } from '@/components/ui';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { DashboardShortcuts } from '@/components/dashboard/DashboardShortcuts';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { useAdminDashboard, useTopRoutes } from '@/hooks/useAdminDashboard';
import { useActivityTimeSeries } from '@/hooks/useActivityTimeSeries';
import { formatMoney, formatNumber } from '@/utils/money';
import { plural } from '@/utils/text';

const ACTIVITY_WEEKS = 8;

function SectionTitle({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'accent' }) {
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className={`h-5 w-1 rounded-full ${tone === 'primary' ? 'bg-primary' : 'bg-accent'}`} />
      <h2 className="text-lg font-semibold text-text-primary">{children}</h2>
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError } = useAdminDashboard();
  const { data: topRoutes } = useTopRoutes();

  const activityWindow = useMemo(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - ACTIVITY_WEEKS * 7);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);
  const { data: activitySeries } = useActivityTimeSeries('week', activityWindow.from, activityWindow.to);

  if (isError) {
    return (
      <p className="text-sm text-danger">
        Impossible de charger le tableau de bord — vérifiez que votre compte a la permission requise
        (DASHBOARD_ADMIN_READ).
      </p>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-text-secondary">Chargement…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Tableau de bord</h1>
        <p className="text-sm text-text-secondary">Actifs sur les {data.active.windowDays} derniers jours.</p>
      </div>

      <DashboardHero />

      <DashboardShortcuts />

      <div>
        <SectionTitle>Aperçu</SectionTitle>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
          <StatCard
            index={0}
            label="Utilisateurs"
            value={formatNumber(data.users.total)}
            icon={IconUsers}
            sublabel={`${formatNumber(data.users.drivers)} ${plural(data.users.drivers, 'chauffeur')} · ${formatNumber(data.users.customers)} ${plural(data.users.customers, 'client')}`}
          />
          <StatCard
            index={1}
            label="Chauffeurs vérifiés"
            value={formatNumber(data.users.verifiedDrivers)}
            icon={IconUserCheck}
            tone="success"
            sublabel={`sur ${formatNumber(data.users.drivers)} au total`}
          />
          <StatCard
            index={2}
            label="Utilisateurs actifs (30j)"
            value={formatNumber(data.active.drivers + data.active.customers)}
            icon={IconUsers}
            tone="accent"
            sublabel={`${formatNumber(data.active.drivers)} ${plural(data.active.drivers, 'chauffeur')} · ${formatNumber(data.active.customers)} ${plural(data.active.customers, 'client')}`}
          />
          <StatCard
            index={3}
            label="Trajets"
            value={formatNumber(data.trips.total)}
            icon={IconRoute}
            sublabel={`${formatNumber(data.trips.bookings)} ${plural(data.trips.bookings, 'réservation')} · ${formatNumber(data.trips.completedBookings)} ${plural(data.trips.completedBookings, 'terminée')}`}
          />
          <StatCard
            index={4}
            label="Envois"
            value={formatNumber(data.shipments.total)}
            icon={IconPackage}
            sublabel={`${formatNumber(data.shipments.completed)} ${plural(data.shipments.completed, 'terminé')}`}
          />
          <StatCard
            index={5}
            label="Litiges ouverts"
            value={formatNumber(data.disputes.open)}
            icon={IconAlertTriangle}
            tone="danger"
            sublabel={
              data.disputes.resolutionRatePercent !== null
                ? `${data.disputes.resolutionRatePercent}% de résolution`
                : `${formatNumber(data.disputes.total)} au total`
            }
          />
        </div>
      </div>

      <div>
        <SectionTitle tone="accent">Finances</SectionTitle>
        {/* Une devise ne s'additionne jamais à une autre (1 GNF ≠ 1 XOF) —
            un bloc de 3 cartes par devise active, jamais un seul total mélangé. */}
        <div className="space-y-4">
          {data.finance.map((figures) => (
            <div key={figures.currencyId}>
              {data.finance.length > 1 ? (
                <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-text-muted">{figures.isoCode}</p>
              ) : null}
              <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
                <StatCard
                  index={0}
                  label="Revenu brut trajets"
                  value={formatMoney(figures.grossBookingRevenue, figures.isoCode)}
                  icon={IconCash}
                  sublabel={`Commission : ${formatMoney(figures.bookingCommission, figures.isoCode)}`}
                />
                <StatCard
                  index={1}
                  label="Revenu brut envois"
                  value={formatMoney(figures.grossShipmentRevenue, figures.isoCode)}
                  icon={IconCash}
                  sublabel={`Commission : ${formatMoney(figures.shipmentCommission, figures.isoCode)}`}
                />
                <StatCard
                  index={2}
                  label="Remboursé"
                  value={formatMoney(figures.refundedAmount, figures.isoCode)}
                  icon={IconCash}
                  tone="danger"
                  sublabel={`${formatNumber(figures.refundedCount)} ${plural(figures.refundedCount, 'remboursement')}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card padded={false} className="p-4 sm:p-5">
          <SectionTitle>Évolution ({ACTIVITY_WEEKS} dernières semaines)</SectionTitle>
          {activitySeries ? (
            <ActivityChart points={activitySeries} granularity="week" />
          ) : (
            <div className="h-32 animate-pulse rounded bg-surface-muted sm:h-40" />
          )}
        </Card>

        <Card padded={false} className="p-4 sm:p-5">
          <SectionTitle tone="accent">Trajets les plus demandés</SectionTitle>
          {!topRoutes ? (
            <div className="h-32 animate-pulse rounded bg-surface-muted sm:h-40" />
          ) : topRoutes.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Aucune réservation pour l'instant.</p>
          ) : (
            <ul className="space-y-2.5">
              {topRoutes.map((route, index) => (
                <li key={`${route.originName}-${route.destinationName}`} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary-light text-xs font-bold text-primary-dark">
                    {index + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-medium text-text-primary">
                    <IconTrendingUp size={14} className="shrink-0 text-text-muted" />
                    <span className="truncate">
                      {route.originName} → {route.destinationName}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-text-secondary">
                    {formatNumber(route.bookingCount)} {plural(route.bookingCount, 'réservation')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}