// web-admin/src/app/(app)/drivers/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { IconRosetteDiscountCheck, IconSearch } from '@tabler/icons-react';
import { Badge, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@/components/ui';
import { useDriversList } from '@/hooks/useDrivers';
import { DRIVER_STATUS_LABELS, DRIVER_STATUS_TONE } from '@/utils/driverLabels';
import type { DriverAccountStatus } from '@/types/drivers.types';

const STATUS_OPTIONS = Object.keys(DRIVER_STATUS_LABELS) as DriverAccountStatus[];

export default function DriversPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DriverAccountStatus | ''>('');
  const { data, isLoading, isError } = useDriversList({ search: search || undefined, status: status || undefined });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Chauffeurs</h1>
        <p className="text-sm text-text-secondary">{data ? `${data.meta.total} au total` : ''}</p>
      </div>

      <div className="flex gap-3">
        <div className="relative max-w-xs flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nom ou prénom…"
            className="pl-9"
          />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value as DriverAccountStatus | '')} className="max-w-xs">
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
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nom</TableHeaderCell>
              <TableHeaderCell>Ville</TableHeaderCell>
              <TableHeaderCell>Trajets terminés</TableHeaderCell>
              <TableHeaderCell>Note</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.data ?? []).map((driver) => (
              <TableRow key={driver.id} className="hover:bg-surface-muted/50">
                <TableCell>
                  <Link href={`/drivers/${driver.id}`} className="flex items-center gap-2 font-medium text-primary hover:underline">
                    {driver.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={driver.photoUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-light text-xs font-semibold text-primary-dark">
                        {driver.firstName.charAt(0)}
                        {driver.lastName.charAt(0)}
                      </span>
                    )}
                    {driver.firstName} {driver.lastName}
                    {driver.isVerifiedBadge ? <IconRosetteDiscountCheck size={15} className="text-success-dark" /> : null}
                  </Link>
                </TableCell>
                <TableCell className="text-text-secondary">{driver.city?.name ?? '—'}</TableCell>
                <TableCell className="text-text-secondary">{driver.completedTripsCount}</TableCell>
                <TableCell className="text-text-secondary">
                  {driver.averageRating ? `${driver.averageRating.toFixed(1)} (${driver.ratingsCount})` : '—'}
                </TableCell>
                <TableCell>
                  <Badge label={DRIVER_STATUS_LABELS[driver.status]} tone={DRIVER_STATUS_TONE[driver.status]} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
