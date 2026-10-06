// web-admin/src/app/(app)/disputes/page.tsx
//
// v2 — Même structure que les autres pages d'administration : bandeau compact
// (PageHero), filtres statut et priorité sur une seule ligne, cartes avec
// barre de couleur selon la priorité (rouge = critique, orange = haute…),
// pastilles de statut et de priorité, pied de carte « assigné / ouvert le ».
'use client';

import React, { useState } from 'react';
import { IconCalendar, IconChevronRight, IconGavel, IconPackage, IconRoute, IconUserCheck, IconUserOff } from '@tabler/icons-react';
import { Button } from '@/components/ui';
import {
  EmptyState,
  FilterSelect,
  IconTile,
  ListCard,
  ListSkeleton,
  Notice,
  PageHero,
  type Tone,
} from '@/components/admin/AdminUi';
import { useDisputesList } from '@/hooks/useDisputes';
import { DISPUTE_PRIORITY_LABELS, DISPUTE_STATUS_LABELS } from '@/utils/disputeLabels';
import { PriorityPill, StatusPill, disputeRef } from '@/components/disputes/disputeUi';
import type { DisputePriority, DisputeStatus, DisputeSubjectType } from '@/types/disputes.types';

const STATUS_OPTIONS = (Object.keys(DISPUTE_STATUS_LABELS) as DisputeStatus[]).map((value) => ({
  value,
  label: DISPUTE_STATUS_LABELS[value],
}));
const PRIORITY_OPTIONS = (Object.keys(DISPUTE_PRIORITY_LABELS) as DisputePriority[]).map((value) => ({
  value,
  label: DISPUTE_PRIORITY_LABELS[value],
}));

const PRIORITY_TONE: Record<DisputePriority, Tone> = {
  LOW: 'neutral',
  MEDIUM: 'primary',
  HIGH: 'accent',
  CRITICAL: 'danger',
};

const SUBJECT_LABEL: Record<DisputeSubjectType, string> = { SHIPMENT: 'Envoi', TRIP: 'Trajet' };

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export default function DisputesPage() {
  const [status, setStatus] = useState<DisputeStatus | ''>('');
  const [priority, setPriority] = useState<DisputePriority | ''>('');
  const { data, isLoading, isError } = useDisputesList({
    status: status || undefined,
    priority: priority || undefined,
  });

  const disputes = data?.data ?? [];
  const total = data?.meta.total;
  const hasFilters = status !== '' || priority !== '';
  const isTruncated = total !== undefined && disputes.length < total;

  function resetFilters() {
    setStatus('');
    setPriority('');
  }

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Support"
        title="Litiges"
        description="Réclamations ouvertes par les clients et les conducteurs, à traiter par priorité."
        stats={[
          {
            value: total !== undefined ? String(total) : '…',
            label: hasFilters ? (total === 1 ? 'résultat' : 'résultats') : total === 1 ? 'litige' : 'litiges',
          },
        ]}
      />

      <div className="grid grid-cols-2 gap-2 sm:max-w-xl">
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Tous les statuts" ariaLabel="Filtrer par statut" />
        <FilterSelect
          value={priority}
          onChange={setPriority}
          options={PRIORITY_OPTIONS}
          allLabel="Toutes priorités"
          ariaLabel="Filtrer par priorité"
        />
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger les litiges.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={6} heightClass="h-40" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={<IconGavel size={26} />}
          title="Aucun litige"
          text={hasFilters ? 'Aucun litige ne correspond à ces filtres.' : 'Tout est calme pour le moment.'}
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
            {disputes.map((dispute) => {
              const isShipment = dispute.subjectType === 'SHIPMENT';
              const isAssigned = dispute.assignedAgentId !== null;

              return (
                <ListCard key={dispute.id} href={`/disputes/${dispute.id}`} tone={PRIORITY_TONE[dispute.priority]}>
                  <div className="flex items-start gap-3">
                    <IconTile tone={isShipment ? 'accent' : 'primary'}>
                      {isShipment ? <IconPackage size={20} /> : <IconRoute size={20} />}
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <h2 className="line-clamp-2 break-words font-semibold leading-snug text-text-primary">
                        {dispute.reason}
                      </h2>
                      <p className="mt-0.5 text-xs text-text-muted">
                        {SUBJECT_LABEL[dispute.subjectType]} · {disputeRef(dispute.id)}
                      </p>
                    </div>
                    <IconChevronRight
                      size={18}
                      className="mt-1 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
                    />
                  </div>

                  {dispute.description ? (
                    <p className="mt-2 line-clamp-2 break-words text-sm text-text-secondary">{dispute.description}</p>
                  ) : null}

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <StatusPill status={dispute.status} />
                    <PriorityPill priority={dispute.priority} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-border/70 pt-2.5 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold ${
                        isAssigned ? 'bg-success-light text-success-dark' : 'bg-accent-light text-accent-dark'
                      }`}
                    >
                      {isAssigned ? <IconUserCheck size={14} /> : <IconUserOff size={14} />}
                      {isAssigned ? 'Assigné' : 'Non assigné'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-text-muted">
                      <IconCalendar size={14} />
                      Ouvert le {dateFormatter.format(new Date(dispute.createdAt))}
                    </span>
                  </div>
                </ListCard>
              );
            })}
          </div>
          {isTruncated ? (
            <p className="text-center text-xs text-text-muted">
              Affichage de {disputes.length} sur {total} — filtre par statut ou priorité pour voir les autres.
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
