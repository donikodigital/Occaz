// web-admin/src/app/(app)/shipments/page.tsx
//
// v2 — Cartes plus compactes et plus modernes : barre de couleur selon la
// situation de l'envoi, pastilles (statut, prolongation, urgent) sous
// l'itinéraire, période et conducteur sur des lignes serrées, montant en
// pied de carte. Les 4 statistiques du bandeau tiennent sur une seule ligne.
// v1 — Suivi des envois pour l'équipe : filtres par situation (en recherche,
// prolongation demandée, en cours, terminés…) et recherche. La liste se
// rafraîchit toute seule toutes les 30 s.

'use client';

import React, { useMemo, useState } from 'react';
import {
  IconChevronRight,
  IconClockExclamation,
  IconPackage,
} from '@tabler/icons-react';
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
import { useShipmentsList } from '@/hooks/useShipments';
import { formatMoney } from '@/utils/money';
import {
  SHIPMENT_GROUP_OPTIONS,
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  groupOf,
  routeLabel,
  type ShipmentGroup,
} from '@/utils/shipmentLabels';
import type { AdminShipmentListItem } from '@/types/shipments.types';

function ShipmentCard({ shipment }: { shipment: AdminShipmentListItem }) {
  const currencyCode = shipment.currency?.isoCode;
  const needsCustomer = shipment.status === 'SEARCHING_DRIVER' && shipment.extensionRequestedAt !== null;
  const tone = needsCustomer ? 'accent' : SHIPMENT_STATUS_TONE[shipment.status];

  return (
    <ListCard href={`/shipments/${shipment.id}`} tone={tone}>
      <div className="flex items-center gap-3">
        <IconTile tone={tone}>{needsCustomer ? <IconClockExclamation size={20} /> : <IconPackage size={20} />}</IconTile>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 break-words font-semibold leading-snug text-text-primary">{routeLabel(shipment)}</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              <Chip tone={SHIPMENT_STATUS_TONE[shipment.status]}>{SHIPMENT_STATUS_LABELS[shipment.status]}</Chip>
              {needsCustomer ? <Chip tone="accent">Prolongation</Chip> : null}
              {shipment.isUrgent ? <Chip tone="danger">Urgent</Chip> : null}
            </div>
            <span className="shrink-0 text-sm font-bold text-text-primary">{formatMoney(shipment.totalAmount, currencyCode)}</span>
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
    <div className="space-y-4">
      <PageHero
        eyebrow="Opérations"
        title="Envois"
        description="Suivi des colis : demandes en recherche de conducteur, envois en cours et terminés."
        stats={[
          { value: data ? String(shipments.length) : '…', label: shipments.length > 1 ? 'envois' : 'envoi' },
          { value: data ? String(counts.searching) : '…', label: 'en recherche' },
          { value: data ? String(counts.extension) : '…', label: 'à prolonger' },
          { value: data ? String(counts.active) : '…', label: 'en cours' },
        ]}
      />

      {counts.extension > 0 ? (
        <Notice>
          {counts.extension} {counts.extension > 1 ? 'demandes ont' : 'demande a'} dépassé leur période sans conducteur :
          le client a été invité à prolonger, sinon il est remboursé automatiquement.
        </Notice>
      ) : null}

      <div className="space-y-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un client, une ville, un conducteur…"
          ariaLabel="Rechercher un envoi"
        />
        <FilterChips value={group} onChange={setGroup} options={options} allLabel={`Tous (${shipments.length})`} />
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger les envois.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-24" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
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
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((shipment) => (
            <ShipmentCard key={shipment.id} shipment={shipment} />
          ))}
        </div>
      )}
    </div>
  );
}