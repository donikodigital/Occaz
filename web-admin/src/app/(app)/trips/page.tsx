// web-admin/src/app/(app)/trips/page.tsx
//
// v1 — Suivi des trajets pour l'équipe : une carte ombrée par trajet
// (itinéraire, statut, départ, chauffeur, places, prix), filtres par
// situation (recherche de passagers, en cours, terminés…) et recherche.
// Même structure que la page Envois. La liste se rafraîchit toute seule
// toutes les 30 s.

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconChevronRight, IconRoute, IconSearch, IconSteeringWheel, IconUsers } from '@tabler/icons-react';
import { Chip, EmptyState, FilterChips, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { useTripsList } from '@/hooks/useTrips';
import { formatMoney } from '@/utils/money';
import {
  TRIP_GROUP_OPTIONS,
  TRIP_STATUS_LABELS,
  TRIP_STATUS_TONE,
  formatDateTime,
  formatShortDate,
  groupOf,
  routeLabel,
  type TripGroup,
} from '@/utils/tripLabels';
import type { AdminTripListItem } from '@/types/trips.types';

function TripCard({ trip }: { trip: AdminTripListItem }) {
  const currencyCode = trip.currency?.isoCode;

  return (
    <Link
      href={`/trips/${trip.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <IconRoute size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{routeLabel(trip)}</p>
          <p className="truncate text-xs text-text-secondary">{formatDateTime(trip.departureAt)}</p>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={TRIP_STATUS_TONE[trip.status]}>{TRIP_STATUS_LABELS[trip.status]}</Chip>
      </div>

      <div className="space-y-1.5 text-sm text-text-secondary">
        <p className="flex items-center gap-2">
          <IconSteeringWheel size={15} className="shrink-0 text-text-muted" />
          {trip.driver.firstName} {trip.driver.lastName}
        </p>
        <p className="flex items-center gap-2">
          <IconUsers size={15} className="shrink-0 text-text-muted" />
          {trip.availableSeats} place{trip.availableSeats > 1 ? 's' : ''} libre{trip.availableSeats > 1 ? 's' : ''} sur{' '}
          {trip.totalSeats}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-lg font-bold leading-none text-text-primary">{formatMoney(trip.pricePerSeat, currencyCode)}</p>
          <p className="mt-1 text-xs text-text-muted">par place</p>
        </div>
        <span className="text-xs text-text-muted">Créé le {formatShortDate(trip.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function TripsPage() {
  const { data, isLoading, isError } = useTripsList();
  const [group, setGroup] = useState<TripGroup | ''>('');
  const [search, setSearch] = useState('');

  const trips = useMemo(() => data?.data ?? [], [data]);

  const counts = useMemo(() => {
    const result: Record<TripGroup, number> = {
      draft: 0,
      searching: 0,
      active: 0,
      done: 0,
      disputed: 0,
      closed: 0,
    };
    for (const trip of trips) result[groupOf(trip)] += 1;
    return result;
  }, [trips]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return trips.filter((trip) => {
      if (group && groupOf(trip) !== group) return false;
      if (!query) return true;
      const haystack = [routeLabel(trip), `${trip.driver.firstName} ${trip.driver.lastName}`].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [trips, group, search]);

  const options = TRIP_GROUP_OPTIONS.map((option) => ({
    value: option.value,
    label: `${option.label} (${counts[option.value]})`,
  }));

  const hasFilters = group !== '' || search.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Opérations"
        title="Trajets"
        description="Suivi des trajets partagés : recherche de passagers, trajets en cours et terminés."
        stats={[
          { value: data ? String(trips.length) : '…', label: trips.length > 1 ? 'trajets récents' : 'trajet récent' },
          { value: data ? String(counts.searching) : '…', label: 'en recherche' },
          { value: data ? String(counts.active) : '…', label: 'en cours' },
          { value: data ? String(counts.disputed) : '…', label: 'en litige' },
        ]}
      />

      <div className="relative">
        <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher une ville, un chauffeur…"
          aria-label="Rechercher un trajet"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <FilterChips value={group} onChange={setGroup} options={options} allLabel={`Tous (${trips.length})`} />

      {isError ? (
        <Notice tone="danger">Impossible de charger les trajets.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-48" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconRoute size={26} />}
          title={hasFilters ? 'Aucun trajet ne correspond' : 'Aucun trajet pour l’instant'}
          text={
            hasFilters
              ? 'Essaie une autre recherche ou retire le filtre.'
              : 'Les trajets publiés par les chauffeurs apparaîtront ici.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}