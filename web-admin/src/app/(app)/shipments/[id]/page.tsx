// web-admin/src/app/(app)/shipments/[id]/page.tsx
//
// v1 — Détail d'un envoi pour l'équipe : montants (payé, gain du chauffeur,
// commission), période demandée, expéditeur et destinataire, colis, chauffeur
// et frise de suivi. Lecture seule : un désaccord se traite depuis « Litiges »,
// qui peut décider d'un remboursement.

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { IconPackage } from '@tabler/icons-react';
import { BackHeader, Chip, Notice, SectionCard } from '@/components/admin/AdminUi';
import { useShipmentDetail } from '@/hooks/useShipments';
import { formatMoney } from '@/utils/money';
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  driverNet,
  formatDateTime,
  formatWindow,
  routeLabel,
} from '@/utils/shipmentLabels';

const CANCELLED_BY_LABELS: Record<string, string> = {
  CUSTOMER: 'le client',
  DRIVER: 'le chauffeur',
  SUPPORT: 'le support',
  SYSTEM: 'le système (automatique)',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-0.5 break-words text-sm font-medium text-text-primary">{children}</div>
    </div>
  );
}

function MoneyTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${highlight ? 'bg-primary-light' : 'bg-border/30'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`mt-1 text-base font-bold sm:text-lg ${highlight ? 'text-primary' : 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="h-10 w-40 animate-pulse rounded-xl bg-border/50" />
      <div className="h-28 animate-pulse rounded-2xl bg-border/50" />
      <div className="h-40 animate-pulse rounded-2xl bg-border/50" />
    </div>
  );
}

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: shipment, isLoading, isError } = useShipmentDetail(id);

  if (isError) {
    return (
      <div className="max-w-3xl space-y-6">
        <BackHeader href="/shipments" backLabel="Envois" title="Envoi introuvable" />
        <Notice tone="danger">Cet envoi n’existe plus ou n’a pas pu être chargé.</Notice>
      </div>
    );
  }
  if (isLoading || !shipment) return <Loading />;

  const currencyCode = shipment.currency?.isoCode;
  const dimensions =
    shipment.lengthCm != null && shipment.widthCm != null && shipment.heightCm != null
      ? `${shipment.lengthCm} × ${shipment.widthCm} × ${shipment.heightCm} cm`
      : null;
  const awaitingCustomer = shipment.status === 'SEARCHING_DRIVER' && shipment.extensionRequestedAt !== null;
  const tracking = shipment.tracking ?? [];

  return (
    <div className="max-w-3xl space-y-5">
      <BackHeader
        href="/shipments"
        backLabel="Envois"
        title={routeLabel(shipment)}
        subtitle={`${shipment.category?.name ?? 'Colis'} · ${shipment.weightKg} kg`}
        badge={<Chip tone={SHIPMENT_STATUS_TONE[shipment.status]}>{SHIPMENT_STATUS_LABELS[shipment.status]}</Chip>}
      />

      {awaitingCustomer ? (
        <Notice>
          La période s’est terminée sans chauffeur. Le client a été invité à prolonger le {formatDateTime(shipment.extensionRequestedAt!)} ;
          sans réponse dans le délai réglé dans les paramètres, il est remboursé intégralement et automatiquement.
        </Notice>
      ) : null}

      {shipment.cancelledAt ? (
        <Notice tone="danger">
          Annulé le {formatDateTime(shipment.cancelledAt)}
          {shipment.cancelledBy ? ` par ${CANCELLED_BY_LABELS[shipment.cancelledBy] ?? shipment.cancelledBy}` : ''}
          {shipment.cancellationReason ? ` — ${shipment.cancellationReason}` : ''}. Le client est remboursé à 100 %.
        </Notice>
      ) : null}

      <SectionCard title="Montants" description="Le client paie un seul montant ; la commission est prélevée sur le gain du chauffeur.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <MoneyTile label="Payé par le client" value={formatMoney(shipment.totalAmount, currencyCode)} highlight />
          <MoneyTile
            label="Gain du chauffeur"
            value={formatMoney(driverNet(shipment.totalAmount, shipment.platformFee), currencyCode)}
          />
          <MoneyTile label="Commission" value={formatMoney(shipment.platformFee, currencyCode)} />
        </div>
      </SectionCard>

      <SectionCard title="Période demandée">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Le colis peut partir">{formatWindow(shipment.windowStart, shipment.windowEnd)}</Field>
          <Field label="Envoi créé">{formatDateTime(shipment.createdAt)}</Field>
        </div>
        {shipment.isUrgent ? <Chip tone="danger">Envoi urgent</Chip> : null}
      </SectionCard>

      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard title="Expéditeur">
          <div className="space-y-3">
            <Field label="Nom">{shipment.senderName}</Field>
            <Field label="Téléphone">
              <a href={`tel:${shipment.senderPhone}`} className="text-primary hover:underline">
                {shipment.senderPhone}
              </a>
            </Field>
            <Field label="Adresse de récupération">{shipment.senderLocation?.label ?? '—'}</Field>
          </div>
        </SectionCard>

        <SectionCard title="Destinataire">
          <div className="space-y-3">
            <Field label="Nom">{shipment.recipientName}</Field>
            <Field label="Téléphone">
              <a href={`tel:${shipment.recipientPhone}`} className="text-primary hover:underline">
                {shipment.recipientPhone}
              </a>
            </Field>
            <Field label="Adresse de livraison">{shipment.recipientLocation?.label ?? '—'}</Field>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Colis">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Catégorie">{shipment.category?.name ?? '—'}</Field>
          <Field label="Poids">{shipment.weightKg} kg</Field>
          <Field label="Quantité">{shipment.quantity}</Field>
          {dimensions ? <Field label="Dimensions">{dimensions}</Field> : null}
          {shipment.declaredValue ? (
            <Field label="Valeur déclarée">{formatMoney(shipment.declaredValue, currencyCode)}</Field>
          ) : null}
        </div>
        {shipment.description ? <Field label="Description">{shipment.description}</Field> : null}
        {shipment.instructions ? <Field label="Consignes">{shipment.instructions}</Field> : null}
      </SectionCard>

      <SectionCard title="Chauffeur">
        {shipment.driver ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-sm font-bold text-primary">
              {`${shipment.driver.firstName.charAt(0)}${shipment.driver.lastName.charAt(0)}`.toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-text-primary">
                {shipment.driver.firstName} {shipment.driver.lastName}
              </p>
              <p className="text-xs text-text-secondary">
                {shipment.driver.averageRating !== null
                  ? `Note ${shipment.driver.averageRating.toFixed(1)} · ${shipment.driver.ratingsCount} avis`
                  : 'Pas encore noté'}
              </p>
            </div>
            <Chip tone={shipment.tripId ? 'primary' : 'neutral'}>{shipment.tripId ? 'Sur un de ses trajets' : 'Sans trajet précis'}</Chip>
          </div>
        ) : (
          <p className="text-sm text-text-secondary">Aucun chauffeur n’a encore accepté cet envoi.</p>
        )}
      </SectionCard>

      {tracking.length > 0 ? (
        <SectionCard title="Suivi">
          <ol className="space-y-0">
            {tracking.map((entry, index) => (
              <li key={entry.id} className="flex gap-3">
                <div className="flex w-3 flex-col items-center">
                  <span className={`mt-1.5 h-2.5 w-2.5 rounded-full ${index === tracking.length - 1 ? 'bg-primary' : 'bg-border'}`} />
                  {index < tracking.length - 1 ? <span className="w-0.5 flex-1 bg-border" /> : null}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-semibold text-text-primary">{SHIPMENT_STATUS_LABELS[entry.status]}</p>
                  <p className="text-xs text-text-secondary">{formatDateTime(entry.recordedAt)}</p>
                  {entry.note ? <p className="mt-0.5 text-xs text-text-muted">{entry.note}</p> : null}
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      ) : null}

      <p className="flex items-center gap-2 text-xs text-text-muted">
        <IconPackage size={14} />
        Un désaccord se traite depuis « Litiges », qui peut décider d’un remboursement.
      </p>
    </div>
  );
}