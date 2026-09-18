// web-admin/src/app/(app)/drivers/page.tsx
'use client';

import React, { useState } from 'react';
import { IconRosetteDiscountCheck, IconSearch, IconStarFilled } from '@tabler/icons-react';
import { Badge, EntityAvatar, EntityListCard, Select, TextField } from '@/components/ui';
import { useDriversList } from '@/hooks/useDrivers';
import { DRIVER_STATUS_LABELS, DRIVER_STATUS_TONE } from '@/utils/driverLabels';
import type { DriverAccountStatus } from '@/types/drivers.types';
import { DriverDetailModal } from '@/components/drivers/DriverDetailModal';

const STATUS_OPTIONS = Object.keys(DRIVER_STATUS_LABELS) as DriverAccountStatus[];

export default function DriversPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DriverAccountStatus | ''>('');
  const { data, isLoading, isError } = useDriversList({ search: search || undefined, status: status || undefined });

  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Chauffeurs</h1>
        <p className="text-sm text-text-secondary">{data ? `${data.meta.total} au total` : ''}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[180px] flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextField value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nom ou prénom…" className="pl-9" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as DriverAccountStatus | '')} className="max-w-[200px]">
          <option value="">Tous les statuts</option>
          {STATUS_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {DRIVER_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
      </div>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les chauffeurs.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (data?.data.length ?? 0) === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">Aucun chauffeur ne correspond à cette recherche.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {(data?.data ?? []).map((driver) => (
            <EntityListCard
              key={driver.id}
              avatar={
                <EntityAvatar
                  initials={`${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`}
                  imageUrl={driver.photoUrl}
                  tone="primary"
                />
              }
              title={
                <span className="inline-flex items-center gap-1.5">
                  {driver.firstName} {driver.lastName}
                  {driver.isVerifiedBadge ? <IconRosetteDiscountCheck size={15} className="shrink-0 text-success-dark" /> : null}
                </span>
              }
              subtitle={driver.city?.name ?? '—'}
              badges={
                <>
                  <Badge label={DRIVER_STATUS_LABELS[driver.status]} tone={DRIVER_STATUS_TONE[driver.status]} />
                  {driver.averageRating ? (
                    <span className="inline-flex items-center gap-0.5 text-xs text-text-secondary">
                      <IconStarFilled size={11} className="text-accent" />
                      {driver.averageRating.toFixed(1)}
                    </span>
                  ) : null}
                </>
              }
              onClick={() => setSelectedDriverId(driver.id)}
            />
          ))}
        </div>
      )}

      <DriverDetailModal open={selectedDriverId !== null} onClose={() => setSelectedDriverId(null)} driverId={selectedDriverId} />
    </div>
  );
}