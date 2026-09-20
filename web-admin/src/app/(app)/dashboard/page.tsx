// web-admin/src/app/(app)/dashboard/page.tsx
'use client';

import React from 'react';
import {
  IconAlertTriangle,
  IconCash,
  IconPackage,
  IconRoute,
  IconUserCheck, 
  IconUsers,
} from '@tabler/icons-react';
import { StatCard } from '@/components/layout/StatCard';
import { DashboardHero } from '@/components/dashboard/DashboardHero';
import { DashboardShortcuts } from '@/components/dashboard/DashboardShortcuts';
import { useAdminDashboard } from '@/hooks/useAdminDashboard';
import { formatMoney, formatNumber } from '@/utils/money';

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
            label="Utilisateurs"
            value={formatNumber(data.users.total)}
            icon={IconUsers}
            sublabel={`${formatNumber(data.users.drivers)} chauffeurs · ${formatNumber(data.users.customers)} clients`}
          />
          <StatCard
            label="Chauffeurs vérifiés"
            value={formatNumber(data.users.verifiedDrivers)}
            icon={IconUserCheck}
            tone="success"
            sublabel={`sur ${formatNumber(data.users.drivers)} au total`}
          />
          <StatCard
            label="Utilisateurs actifs"
            value={formatNumber(data.active.drivers + data.active.customers)}
            icon={IconUsers}
            tone="accent"
            sublabel={`${formatNumber(data.active.drivers)} chauffeurs · ${formatNumber(data.active.customers)} clients`}
          />
          <StatCard
            label="Trajets"
            value={formatNumber(data.trips.total)}
            icon={IconRoute}
            sublabel={`${formatNumber(data.trips.bookings)} réservations · ${formatNumber(data.trips.completedBookings)} terminées`}
          />
          <StatCard
            label="Envois"
            value={formatNumber(data.shipments.total)}
            icon={IconPackage}
            sublabel={`${formatNumber(data.shipments.completed)} terminés`}
          />
          <StatCard
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
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
          <StatCard
            label="Revenu brut trajets"
            value={formatMoney(data.finance.grossBookingRevenue)}
            icon={IconCash}
            sublabel={`Commission : ${formatMoney(data.finance.bookingCommission)}`}
          />
          <StatCard
            label="Revenu brut envois"
            value={formatMoney(data.finance.grossShipmentRevenue)}
            icon={IconCash}
            sublabel={`Commission : ${formatMoney(data.finance.shipmentCommission)}`}
          />
          <StatCard
            label="Remboursé"
            value={formatMoney(data.finance.refundedAmount)}
            icon={IconCash}
            tone="danger"
            sublabel={`${formatNumber(data.finance.refundedCount)} remboursement(s)`}
          />
        </div>
      </div>
    </div>
  );
}