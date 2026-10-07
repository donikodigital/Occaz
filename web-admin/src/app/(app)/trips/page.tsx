// web-admin/src/app/(app)/trips/page.tsx
//
// v2 — Cartes plus compactes et plus modernes : barre de couleur selon la
// situation du trajet, pastille de statut sous l'itinéraire, conducteur et
// places sur une même ligne, prix en pied de carte. Les 4 statistiques du
// bandeau tiennent sur une seule ligne. Recherche et pastilles de filtre
// communes aux autres pages (voir AdminUi).
// v1 — Suivi des trajets pour l'équipe : filtres par situation (recherche de
// passagers, en cours, terminés…) et recherche. La liste se rafraîchit toute
// seule toutes les 30 s.

'use client';

import React, { useMemo, useState } from 'react';
import { IconChevronRight, IconRoute } from '@tabler/icons-react';
import {
  Chip,
  EmptyState,
  FilterChips,
  IconTile,
  ListCard,
  ListSkeleton,
  Notice,
  PageHero,
  SearchField,
} from '@/components/admin/AdminUi';
import { useTripsList } from '@/hooks/useTrips';
import { formatMoney } from '@/utils/money';
import {
  TRIP_GROUP_OPTIONS,
  TRIP_STATUS_LABELS,
  TRIP_STATUS_TONE,
  formatDateTime,
  groupOf,
  routeLabel,
  type TripGroup,
} from '@/utils/tripLabels';
import type { AdminTripListItem } from '@/types/trips.types';

function TripCard({ trip }: { trip: AdminTripListItem }) {
  const currencyCode = trip.currency?.isoCode;
  const tone = TRIP_STATUS_TONE[trip.status];

  return (
    <ListCard href={`/trips/${trip.id}`} tone={tone}>
      <div className="flex items-center gap-3">
        <IconTile tone={tone}>
          <IconRoute size={20} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 break-words font-semibold leading-snug text-text-primary">{routeLabel(trip)}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Chip tone={tone}>{TRIP_STATUS_LABELS[trip.status]}</Chip>
              <span className="truncate text-xs text-text-secondary">{formatDateTime(trip.departureAt)}</span>
            </div>
            <span className="shrink-0 text-sm font-bold text-text-primary">{formatMoney(trip.pricePerSeat, currencyCode)}</span>
          </div>
        </div>
        <IconChevronRight
          size={18}
          className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
        />
      </div>
    </ListCard>
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
    <div className="space-y-4">
      <PageHero
        eyebrow="Opérations"
        title="Trajets"
        description="Suivi des trajets partagés : recherche de passagers, trajets en cours et terminés."
        stats={[
          { value: data ? String(trips.length) : '…', label: trips.length > 1 ? 'trajets' : 'trajet' },
          { value: data ? String(counts.searching) : '…', label: 'en recherche' },
          { value: data ? String(counts.active) : '…', label: 'en cours' },
          { value: data ? String(counts.disputed) : '…', label: 'en litige' },
        ]}
      />

      <div className="space-y-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une ville, un conducteur…"
          ariaLabel="Rechercher un trajet"
        />
        <FilterChips value={group} onChange={setGroup} options={options} allLabel={`Tous (${trips.length})`} />
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger les trajets.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-24" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconRoute size={26} />}
          title={hasFilters ? 'Aucun trajet ne correspond' : 'Aucun trajet pour l’instant'}
          text={
            hasFilters
              ? 'Essaie une autre recherche ou retire le filtre.'
              : 'Les trajets publiés par les conducteurs apparaîtront ici.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  );
}