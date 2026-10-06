// web-admin/src/app/(app)/drivers/page.tsx
//
// v2 — Même structure que les autres pages d'administration : bandeau compact
// (PageHero), champ de recherche commun (différé de 300 ms), statuts en
// pastilles défilantes sans barre visible, cartes compactes avec barre de
// couleur selon le statut. Fini le grand bandeau coloré de chaque carte : la
// photo, le nom, la ville, la note et les compteurs tiennent sur 4 lignes.
// Vocabulaire : « conducteur ».
'use client';

import React, { useEffect, useState } from 'react';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconMapPin,
  IconRosetteDiscountCheck,
  IconSteeringWheel,
  IconStarFilled,
} from '@tabler/icons-react';
import { Button } from '@/components/ui';
import {
  Chip,
  EmptyState,
  FilterChips,
  ListCard,
  ListSkeleton,
  MetaItem,
  Notice,
  PageHero,
  SearchField,
} from '@/components/admin/AdminUi';
import { useDriversList } from '@/hooks/useDrivers';
import { DRIVER_STATUS_LABELS, DRIVER_STATUS_TONE } from '@/utils/driverLabels';
import { DriverDetailModal } from '@/components/drivers/DriverDetailModal';
import { DriverAvatar, driverExtras, formatDate } from '@/components/drivers/driverUi';
import type { DriverAccountStatus } from '@/types/drivers.types';

const SEARCH_DEBOUNCE_MS = 300;

const STATUS_OPTIONS = (Object.keys(DRIVER_STATUS_LABELS) as DriverAccountStatus[]).map((value) => ({
  value,
  label: DRIVER_STATUS_LABELS[value],
}));

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

export default function DriversPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DriverAccountStatus | ''>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const { data, isLoading, isError } = useDriversList({
    search: debouncedSearch || undefined,
    status: status || undefined,
  });

  const drivers = data?.data ?? [];
  const total = data?.meta.total;
  const hasFilters = search.trim() !== '' || status !== '';
  const isTruncated = total !== undefined && drivers.length < total;

  function resetFilters() {
    setSearch('');
    setStatus('');
  }

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Comptes de la plateforme"
        title="Conducteurs"
        description="Vérification, validation et suivi des conducteurs inscrits."
        stats={[
          {
            value: total !== undefined ? String(total) : '…',
            label: hasFilters ? (total === 1 ? 'résultat' : 'résultats') : total === 1 ? 'conducteur' : 'conducteurs',
          },
        ]}
      />

      <div className="space-y-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un conducteur (nom ou prénom)…"
          ariaLabel="Rechercher un conducteur"
        />
        <FilterChips value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Tous les statuts" />
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger les conducteurs.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={6} heightClass="h-36" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : drivers.length === 0 ? (
        <EmptyState
          icon={<IconSteeringWheel size={26} />}
          title="Aucun conducteur"
          text={
            hasFilters
              ? 'Aucun conducteur ne correspond à cette recherche.'
              : 'Les conducteurs apparaîtront ici dès leur inscription.'
          }
          action={
            hasFilters ? (
              <Button type="button" variant="secondary" onClick={resetFilters}>
                Effacer les filtres
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {drivers.map((driver) => {
              const tone = DRIVER_STATUS_TONE[driver.status] ?? 'neutral';
              const extra = driverExtras(driver);
              const hasPhoto = Boolean(driver.photoUrl);
              const counters = [
                { label: 'Trajets', value: extra.completedTripsCount },
                { label: 'Envois', value: extra.completedShipmentsCount },
                { label: 'Avis', value: extra.ratingsCount },
              ].filter((item) => typeof item.value === 'number');

              return (
                <ListCard key={driver.id} onClick={() => setSelectedDriverId(driver.id)} tone={tone}>
                  <div className="flex items-center gap-3">
                    <DriverAvatar
                      firstName={driver.firstName}
                      lastName={driver.lastName}
                      photoUrl={driver.photoUrl}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 font-semibold leading-snug text-text-primary">
                        <span className="truncate">
                          {driver.firstName} {driver.lastName}
                        </span>
                        {driver.isVerifiedBadge ? (
                          <IconRosetteDiscountCheck size={17} className="shrink-0 text-primary" />
                        ) : null}
                      </p>
                      <MetaItem icon={<IconMapPin size={14} />}>{driver.city?.name ?? 'Ville non renseignée'}</MetaItem>
                    </div>
                    <IconChevronRight
                      size={18}
                      className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <Chip tone={tone}>{DRIVER_STATUS_LABELS[driver.status] ?? driver.status}</Chip>
                    {driver.averageRating ? (
                      <Chip tone="accent" icon={<IconStarFilled size={11} />}>
                        {driver.averageRating.toFixed(1)}
                      </Chip>
                    ) : (
                      <Chip>Aucun avis</Chip>
                    )}
                  </div>

                  {counters.length > 0 ? (
                    <div
                      className="mt-2.5 grid gap-2"
                      style={{ gridTemplateColumns: `repeat(${counters.length}, minmax(0, 1fr))` }}
                    >
                      {counters.map((item) => (
                        <div key={item.label} className="rounded-xl bg-surface-muted/70 px-2 py-1.5 text-center">
                          <p className="text-base font-bold leading-none text-text-primary">{item.value}</p>
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
                            {item.label}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {!hasPhoto || extra.createdAt ? (
                    <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-border/70 pt-2 text-xs">
                      {!hasPhoto ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-light px-2 py-1 font-semibold text-danger-dark">
                          <IconAlertTriangle size={13} />
                          Photo manquante
                        </span>
                      ) : (
                        <span />
                      )}
                      {extra.createdAt ? (
                        <span className="text-text-muted">Inscrit le {formatDate(extra.createdAt)}</span>
                      ) : null}
                    </div>
                  ) : null}
                </ListCard>
              );
            })}
          </div>
          {isTruncated ? (
            <p className="text-center text-xs text-text-muted">
              Affichage de {drivers.length} sur {total} — affine ta recherche pour voir les autres.
            </p>
          ) : null}
        </>
      )}

      <DriverDetailModal
        open={selectedDriverId !== null}
        onClose={() => setSelectedDriverId(null)}
        driverId={selectedDriverId}
      />
    </div>
  );
}
