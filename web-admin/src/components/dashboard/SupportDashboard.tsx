// web-admin/src/components/dashboard/SupportDashboard.tsx
// [02/10/2026] Tableau de bord du compte Support : la file de litiges à traiter (nouveaux, urgents), les
// chauffeurs et clients les plus concernés, et les raccourcis permis par ses rôles. Remplace l'erreur
// « DASHBOARD_ADMIN_READ » que voyait un Support, le tableau de bord administrateur lui étant réservé.
// Données : GET /dashboards/support (permission dispute.read). Que des cartes, jamais de tableau.
'use client';

import React from 'react';
import Link from 'next/link';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconFlame,
  IconInbox,
  IconPackage,
  IconRoute,
  IconSteeringWheel,
  IconUser,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import { Badge } from '@/components/ui';
import { StatCard } from '@/components/layout/StatCard';
import { DashboardShortcuts } from '@/components/dashboard/DashboardShortcuts';
import { useSupportDashboard } from '@/hooks/useSupportDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { DISPUTE_PRIORITY_LABELS, DISPUTE_PRIORITY_TONE } from '@/utils/disputeLabels';
import { formatNumber } from '@/utils/money';
import { plural } from '@/utils/text';
import { PERMISSIONS } from '@/utils/permissions';
import type { SupportDisputeSummary } from '@/types/supportDashboard.types';

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

function SectionTitle({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'accent' | 'danger' }) {
  const bar = tone === 'primary' ? 'bg-primary' : tone === 'accent' ? 'bg-accent' : 'bg-danger';
  return (
    <div className="mb-2.5 flex items-center gap-2">
      <span className={`h-5 w-1 rounded-full ${bar}`} />
      <h2 className="text-lg font-semibold text-text-primary">{children}</h2>
    </div>
  );
}

function DisputeCard({ dispute }: { dispute: SupportDisputeSummary }) {
  const isShipment = dispute.subjectType === 'SHIPMENT';
  const openedBy = dispute.openedBy?.email ?? dispute.openedBy?.phone;
  return (
    <Link
      href={`/disputes/${dispute.id}`}
      className="group flex items-center gap-3.5 rounded-2xl border border-border bg-surface p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
          isShipment ? 'bg-accent-light text-accent-dark' : 'bg-primary-light text-primary'
        }`}
      >
        {isShipment ? <IconPackage size={20} /> : <IconRoute size={20} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{dispute.reason}</p>
        <p className="truncate text-xs text-text-secondary">
          {isShipment ? 'Envoi' : 'Trajet'} · ouvert le {dateFormatter.format(new Date(dispute.createdAt))}
          {openedBy ? ` · ${openedBy}` : ''}
        </p>
        <div className="mt-2">
          <Badge label={DISPUTE_PRIORITY_LABELS[dispute.priority]} tone={DISPUTE_PRIORITY_TONE[dispute.priority]} />
        </div>
      </div>
      <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface px-4 py-5 text-sm text-text-secondary">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
        <IconInbox size={20} />
      </span>
      {text}
    </div>
  );
}

function PartyCard({ name, count, kind }: { name: string; count: number; kind: 'driver' | 'customer' }) {
  const Icon = kind === 'driver' ? IconSteeringWheel : IconUser;
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
          kind === 'driver' ? 'bg-success-light text-success-dark' : 'bg-primary-light text-primary'
        }`}
      >
        <Icon size={20} />
      </span>
      <p className="min-w-0 flex-1 truncate font-semibold text-text-primary">{name}</p>
      <Badge label={`${formatNumber(count)} ${plural(count, 'litige')}`} tone="danger" />
    </div>
  );
}

export function SupportDashboard() {
  const { data, isLoading, isError } = useSupportDashboard();
  const { user } = usePermissions();
  const scopedCountries = user?.scopedCountries ?? [];

  if (isError) {
    return (
      <div className="flex items-start gap-2.5 rounded-2xl bg-danger-light/40 px-4 py-3 text-sm text-danger-dark">
        <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
        Impossible de charger votre tableau de bord. Réessayez dans un instant.
      </div>
    );
  }

  if (isLoading || !data) {
    return <p className="text-sm text-text-secondary">Chargement…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-text-primary sm:text-2xl">Tableau de bord</h1>
        <p className="text-sm text-text-secondary">Votre espace Support : les litiges à traiter.</p>
        {scopedCountries.length > 0 ? (
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary-accent bg-primary-light/60 px-3 py-1 text-xs font-semibold text-primary-dark">
            <IconWorld size={14} />
            Périmètre : {scopedCountries.map((country) => country.name).join(', ')}
          </span>
        ) : null}
      </div>

      {/* Bandeau : la file à traiter, d'un coup d'œil */}
      <Link
        href="/disputes"
        className="relative block overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary-dark p-5 text-white shadow-xl shadow-primary-dark/30 transition hover:brightness-110 sm:p-6"
      >
        <IconAlertTriangle size={110} className="pointer-events-none absolute -right-4 -top-4 text-white/10" />
        <p className="text-xs font-medium text-white/75 sm:text-sm">Litiges en cours</p>
        <p className="mt-1 text-4xl font-extrabold tracking-tight tabular-nums sm:text-5xl">
          {formatNumber(data.pendingDisputesCount)}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium sm:text-xs">
            {formatNumber(data.newDisputes.length)} {data.newDisputes.length > 1 ? 'nouveaux' : 'nouveau'} à prendre
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium sm:text-xs">
            {formatNumber(data.urgentDisputes.length)} {data.urgentDisputes.length > 1 ? 'urgents' : 'urgent'}
          </span>
        </div>
      </Link>

      <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        <StatCard index={0} label="En cours" value={formatNumber(data.pendingDisputesCount)} icon={IconAlertTriangle} tone="primary" />
        <StatCard index={1} label="Nouveaux" value={formatNumber(data.newDisputes.length)} icon={IconInbox} tone="accent" />
        <StatCard index={2} label="Urgents" value={formatNumber(data.urgentDisputes.length)} icon={IconFlame} tone="danger" />
      </div>

      <div>
        <SectionTitle tone="accent">Nouveaux litiges</SectionTitle>
        {data.newDisputes.length === 0 ? (
          <EmptyCard text="Aucun nouveau litige : la file est vide." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.newDisputes.map((dispute) => (
              <DisputeCard key={dispute.id} dispute={dispute} />
            ))}
          </div>
        )}
      </div>

      <div>
        <SectionTitle tone="danger">Litiges urgents</SectionTitle>
        {data.urgentDisputes.length === 0 ? (
          <EmptyCard text="Aucun litige urgent en ce moment." />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.urgentDisputes.map((dispute) => (
              <DisputeCard key={dispute.id} dispute={dispute} />
            ))}
          </div>
        )}
      </div>

      {data.flaggedDrivers.length > 0 || data.flaggedCustomers.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.flaggedDrivers.length > 0 ? (
            <div>
              <SectionTitle>Chauffeurs les plus concernés</SectionTitle>
              <div className="space-y-2.5">
                {data.flaggedDrivers.map((driver) => (
                  <PartyCard
                    key={driver.driverId}
                    kind="driver"
                    name={`${driver.firstName} ${driver.lastName}`.trim()}
                    count={driver.disputeCount}
                  />
                ))}
              </div>
            </div>
          ) : null}
          {data.flaggedCustomers.length > 0 ? (
            <div>
              <SectionTitle>Clients les plus concernés</SectionTitle>
              <div className="space-y-2.5">
                {data.flaggedCustomers.map((customer) => (
                  <PartyCard
                    key={customer.customerId}
                    kind="customer"
                    name={`${customer.firstName} ${customer.lastName}`.trim()}
                    count={customer.disputeCount}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <DashboardShortcuts />
    </div>
  );
}

/**
 * Accueil d'un compte qui n'a aucune permission de lecture exploitable (rôle pas encore attribué) :
 * un message clair plutôt qu'une page d'erreurs, avec les raccourcis éventuels.
 */
export function EmptyDashboard() {
  const { user, can } = usePermissions();
  const hasUsers = can(PERMISSIONS.USER_READ);
  return (
    <div className="space-y-5">
      <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-border bg-surface p-8 text-center shadow-xl shadow-primary-dark/10">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-light text-primary shadow-sm">
          <IconUsers size={30} />
        </span>
        <h1 className="mt-5 text-xl font-bold text-text-primary">Bienvenue{user?.email ? `, ${user.email}` : ''}</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-secondary">
          Aucun rôle ne vous donne encore accès à des données. Demandez à un SuperAdmin de vous attribuer le
          rôle adapté à votre mission{hasUsers ? '' : ' (agent clientèle, superviseur…)'}.
        </p>
      </div>
      <DashboardShortcuts />
    </div>
  );
}