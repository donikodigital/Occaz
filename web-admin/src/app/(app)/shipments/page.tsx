// web-admin/src/app/(app)/shipments/page.tsx
//
// v1 — Suivi des envois pour l'équipe : une carte ombrée par envoi (itinéraire,
// statut, période demandée, chauffeur, montant), filtres par situation
// (en recherche, prolongation demandée, en cours, terminés…) et recherche.
// La liste se rafraîchit toute seule toutes les 30 s.

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  IconCalendarEvent,
  IconChevronRight,
  IconClockExclamation,
  IconPackage,
  IconSearch,
  IconSteeringWheel,
} from '@tabler/icons-react';
import { Chip, EmptyState, FilterChips, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { useShipmentsList } from '@/hooks/useShipments';
import { formatMoney } from '@/utils/money';
import {
  SHIPMENT_GROUP_OPTIONS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  driverNet,
  formatShortDate,
  formatWindow,
  groupOf,
  routeLabel,
  type ShipmentGroup,
} from '@/utils/shipmentLabels';
import type { AdminShipmentListItem } from '@/types/shipments.types';

function ShipmentCard({ shipment }: { shipment: AdminShipmentListItem }) {
  const currencyCode = shipment.currency?.isoCode;
  const needsCustomer = shipment.status === 'SEARCHING_DRIVER' && shipment.extensionRequestedAt !== null;

  return (
    <Link
      href={`/shipments/${shipment.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            needsCustomer ? 'bg-accent-light text-accent-dark' : 'bg-primary-light text-primary'
          }`}
        >
          {needsCustomer ? <IconClockExclamation size={22} /> : <IconPackage size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{routeLabel(shipment)}</p>
          <p className="truncate text-xs text-text-secondary">
            {shipment.category?.name ?? 'Colis'} · {shipment.weightKg} kg
          </p>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={SHIPMENT_STATUS_TONE[shipment.status]}>{SHIPMENT_STATUS_LABELS[shipment.status]}</Chip>
        {needsCustomer ? <Chip tone="accent">Prolongation demandée</Chip> : null}
        {shipment.isUrgent ? <Chip tone="danger">Urgent</Chip> : null}
      </div>

      <div className="space-y-1.5 text-sm text-text-secondary">
        <p className="flex items-center gap-2">
          <IconCalendarEvent size={15} className="shrink-0 text-text-muted" />
          {formatWindow(shipment.windowStart, shipment.windowEnd)}
        </p>
        <p className="flex items-center gap-2">
          <IconSteeringWheel size={15} className="shrink-0 text-text-muted" />
          {shipment.driver ? (
            `${shipment.driver.firstName} ${shipment.driver.lastName}`
          ) : (
            <span className="text-text-muted">Aucun chauffeur pour l’instant</span>
          )}
        </p>
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
        <div>
          <p className="text-lg font-bold leading-none text-text-primary">{formatMoney(shipment.totalAmount, currencyCode)}</p>
          <p className="mt-1 text-xs text-text-muted">
            Chauffeur : {formatMoney(driverNet(shipment.totalAmount, shipment.platformFee), currencyCode)}
          </p>
        </div>
        <span className="text-xs text-text-muted">Créé le {formatShortDate(shipment.createdAt)}</span>
      </div>
    </Link>
  );
}

export default function ShipmentsPage() {
  const { data, isLoading, isError } = useShipmentsList();
  const [group, setGroup] = useState<ShipmentGroup | ''>('');
  const [search, setSearch] = useState('');

  const shipments = useMemo(() => data?.data ?? [], [data]);

  const counts = useMemo(() => {
    const result: Record<ShipmentGroup, number> = {
      unpaid: 0,
      searching: 0,
      extension: 0,
      active: 0,
      done: 0,
      closed: 0,
      disputed: 0,
    };
    for (const shipment of shipments) result[groupOf(shipment)] += 1;
    return result;
  }, [shipments]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return shipments.filter((shipment) => {
      if (group && groupOf(shipment) !== group) return false;
      if (!query) return true;
      const haystack = [
        shipment.senderName,
        shipment.recipientName,
        routeLabel(shipment),
        shipment.category?.name ?? '',
        shipment.driver ? `${shipment.driver.firstName} ${shipment.driver.lastName}` : '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [shipments, group, search]);

  const options = SHIPMENT_GROUP_OPTIONS.map((option) => ({
    value: option.value,
    label: `${option.label} (${counts[option.value]})`,
  }));

  const hasFilters = group !== '' || search.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Opérations"
        title="Envois"
        description="Suivi des colis : demandes en recherche de chauffeur, envois en cours et terminés."
        stats={[
          { value: data ? String(shipments.length) : '…', label: shipments.length > 1 ? 'envois récents' : 'envoi récent' },
          { value: data ? String(counts.searching) : '…', label: 'en recherche' },
          { value: data ? String(counts.extension) : '…', label: 'prolongation demandée' },
          { value: data ? String(counts.active) : '…', label: 'en cours' },
        ]}
      />

      {counts.extension > 0 ? (
        <Notice>
          {counts.extension} {counts.extension > 1 ? 'demandes ont' : 'demande a'} dépassé leur période sans chauffeur : le
          client a été invité à prolonger, sinon il est remboursé automatiquement.
        </Notice>
      ) : null}

      <div className="relative">
        <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un client, une ville, un chauffeur…"
          aria-label="Rechercher un envoi"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <FilterChips value={group} onChange={setGroup} options={options} allLabel={`Tous (${shipments.length})`} />

      {isError ? (
        <Notice tone="danger">Impossible de charger les envois.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-52" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconPackage size={26} />}
          title={hasFilters ? 'Aucun envoi ne correspond' : 'Aucun envoi pour l’instant'}
          text={
            hasFilters
              ? 'Essaie une autre recherche ou retire le filtre.'
              : 'Les envois créés par les clients apparaîtront ici dès leur publication.'
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}
    </div>
  );
}