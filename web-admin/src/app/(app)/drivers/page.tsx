// web-admin/src/app/(app)/drivers/page.tsx
'use client';

import React, { useState } from 'react';
import {
  IconAlertTriangle,
  IconCar,
  IconChevronRight,
  IconInbox,
  IconMapPin,
  IconRosetteDiscountCheck,
  IconSearch,
  IconStarFilled,
} from '@tabler/icons-react';
import { useDriversList } from '@/hooks/useDrivers';
import { DRIVER_STATUS_LABELS } from '@/utils/driverLabels';
import { DriverDetailModal } from '@/components/drivers/DriverDetailModal';
import {
  DriverAvatar,
  DriverStatusPill,
  driverExtras,
  driverStatusStyle,
  formatDate,
} from '@/components/drivers/driverUi';
import { CONTROL_CLASS, DisputeMotionStyles, SelectField, Skeleton, disputeFont } from '@/components/disputes/disputeUi';
import type { DriverAccountStatus } from '@/types/drivers.types';

const STATUS_OPTIONS = Object.keys(DRIVER_STATUS_LABELS) as DriverAccountStatus[];

export default function DriversPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DriverAccountStatus | ''>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const { data, isLoading, isError } = useDriversList({ search: search || undefined, status: status || undefined });

  const drivers = data?.data ?? [];
  const total = data?.meta.total;
  const hasFilters = search !== '' || status !== '';

  return (
    <div className={`${disputeFont.className} space-y-6`}>
      <DisputeMotionStyles />

      <header className="dispute-fade-up flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
          <IconCar size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Chauffeurs</h1>
          <p className="text-sm font-medium text-slate-500">
            {total !== undefined ? `${total} chauffeur${total > 1 ? 's' : ''} au total` : '\u00A0'}
          </p>
        </div>
      </header>

      {/* ---------- Filtres : recherche + statut sur la même ligne ---------- */}
      <div
        className="dispute-fade-up rounded-2xl bg-white p-3 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5"
        style={{ animationDelay: '60ms' }}
      >
        <div className="flex items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <IconSearch
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom ou prénom…"
              aria-label="Rechercher un chauffeur"
              className={`${CONTROL_CLASS} pl-10`}
            />
          </div>
          <SelectField
            aria-label="Filtrer par statut"
            value={status}
            onChange={(e) => setStatus(e.target.value as DriverAccountStatus | '')}
            className="w-40 shrink-0 sm:w-56"
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {DRIVER_STATUS_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setStatus('');
            }}
            className="mt-3 px-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      {/* ---------- Résultats ---------- */}
      {isError ? (
        <div className="rounded-2xl bg-rose-50 p-5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
          Impossible de charger les chauffeurs.
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
          <Skeleton className="hidden h-60 sm:block" />
        </div>
      ) : drivers.length === 0 ? (
        <div className="dispute-pop flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-500">
            <IconInbox size={28} />
          </span>
          <p className="mt-4 text-base font-bold text-slate-900">Aucun chauffeur</p>
          <p className="mt-1 text-sm text-slate-500">Aucun chauffeur ne correspond à cette recherche.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {drivers.map((driver, index) => {
            const style = driverStatusStyle(driver.status);
            const extra = driverExtras(driver);
            const hasPhoto = Boolean(driver.photoUrl);
            const stats = [
              { label: 'Trajets', value: extra.completedTripsCount },
              { label: 'Envois', value: extra.completedShipmentsCount },
              { label: 'Avis', value: extra.ratingsCount },
            ].filter((item) => typeof item.value === 'number');

            return (
              <div
                key={driver.id}
                className="dispute-fade-up h-full"
                style={{ animationDelay: `${Math.min(index, 10) * 70 + 120}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setSelectedDriverId(driver.id)}
                  className={`group relative flex h-full w-full flex-col overflow-hidden rounded-2xl bg-white text-left shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${style.hoverGlow} focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99]`}
                >
                  {/* Bandeau coloré selon le statut */}
                  <span className={`relative block h-20 w-full bg-gradient-to-br ${style.banner}`}>
                    <span className="absolute -right-6 -top-10 h-32 w-32 rounded-full bg-white/15" />
                    <span className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-white/10" />
                    <span className="absolute right-3 top-3">
                      <DriverStatusPill status={driver.status} onDark />
                    </span>
                  </span>

                  <span className="flex flex-1 flex-col px-4 pb-4">
                    {/* Avatar qui chevauche le bandeau + note.
                        relative + z-10 : sans ça, le bandeau (relative) se dessine par-dessus l'avatar. */}
                    <span className="relative z-10 -mt-9 flex items-end justify-between gap-3">
                      <DriverAvatar
                        firstName={driver.firstName}
                        lastName={driver.lastName}
                        photoUrl={driver.photoUrl}
                        size="lg"
                      />
                      {driver.averageRating ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
                          <IconStarFilled size={12} className="text-amber-500" />
                          {driver.averageRating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500">
                          Aucun avis
                        </span>
                      )}
                    </span>

                    {/* Identité */}
                    <span className="mt-3 block min-w-0">
                      <span className="flex items-center gap-1.5 text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
                        <span className="break-words">
                          {driver.firstName} {driver.lastName}
                        </span>
                        {driver.isVerifiedBadge ? (
                          <IconRosetteDiscountCheck size={18} className="shrink-0 text-[#0b6aa8]" />
                        ) : null}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-sm font-medium text-slate-500">
                        <IconMapPin size={14} className="shrink-0" />
                        {driver.city?.name ?? 'Ville non renseignée'}
                      </span>
                    </span>

                    {/* Statistiques (si fournies par l'API) */}
                    {stats.length > 0 ? (
                      <span
                        className="mt-4 grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))` }}
                      >
                        {stats.map((item) => (
                          <span
                            key={item.label}
                            className="block rounded-xl bg-slate-50 px-2 py-2 text-center ring-1 ring-inset ring-slate-100"
                          >
                            <span className="block text-base font-extrabold text-slate-900">{item.value}</span>
                            <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              {item.label}
                            </span>
                          </span>
                        ))}
                      </span>
                    ) : null}

                    {/* Pied de carte */}
                    <span className="mt-auto block pt-4">
                      <span className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs">
                        {!hasPhoto ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2 py-1 font-semibold text-rose-700">
                            <IconAlertTriangle size={13} />
                            Photo manquante
                          </span>
                        ) : extra.createdAt ? (
                          <span className="font-medium text-slate-500">Inscrit le {formatDate(extra.createdAt)}</span>
                        ) : (
                          <span />
                        )}
                        <span className="inline-flex items-center gap-1 font-bold text-indigo-600">
                          Voir la fiche
                          <IconChevronRight
                            size={16}
                            className="transition-transform duration-300 group-hover:translate-x-1"
                          />
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <DriverDetailModal
        open={selectedDriverId !== null}
        onClose={() => setSelectedDriverId(null)}
        driverId={selectedDriverId}
      />
    </div>
  );
}