// web-admin/src/app/(app)/disputes/page.tsx
'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  IconCalendar,
  IconChevronRight,
  IconGavel,
  IconInbox,
  IconPackage,
  IconRoute,
  IconUserCheck,
  IconUserOff,
} from '@tabler/icons-react';
import { useDisputesList } from '@/hooks/useDisputes';
import { DISPUTE_PRIORITY_LABELS, DISPUTE_STATUS_LABELS } from '@/utils/disputeLabels';
import {
  DisputeMotionStyles,
  PRIORITY_STYLE,
  PriorityPill,
  SelectField,
  Skeleton,
  StatusPill,
  disputeFont,
  disputeRef,
} from '@/components/disputes/disputeUi';
import type { DisputePriority, DisputeStatus, DisputeSubjectType } from '@/types/disputes.types';

const STATUS_OPTIONS = Object.keys(DISPUTE_STATUS_LABELS) as DisputeStatus[];
const PRIORITY_OPTIONS = Object.keys(DISPUTE_PRIORITY_LABELS) as DisputePriority[];

const SUBJECT_STYLE: Record<DisputeSubjectType, { label: string; gradient: string }> = {
  SHIPMENT: { label: 'Envoi', gradient: 'from-amber-400 to-orange-500 shadow-orange-500/30' },
  TRIP: { label: 'Trajet', gradient: 'from-sky-400 to-blue-600 shadow-blue-500/30' },
};

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

  return (
    <div className={`${disputeFont.className} space-y-6`}>
      <DisputeMotionStyles />

      <header className="dispute-fade-up flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
          <IconGavel size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Litiges</h1>
          <p className="text-sm font-medium text-slate-500">
            {total !== undefined ? `${total} litige${total > 1 ? 's' : ''} au total` : '\u00A0'}
          </p>
        </div>
      </header>

      <div
        className="dispute-fade-up rounded-2xl bg-white p-3 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5"
        style={{ animationDelay: '60ms' }}
      >
        <div className="grid grid-cols-2 gap-3 sm:max-w-xl">
          <SelectField
            aria-label="Filtrer par statut"
            value={status}
            onChange={(e) => setStatus(e.target.value as DisputeStatus | '')}
          >
            <option value="">Tous les statuts</option>
            {STATUS_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {DISPUTE_STATUS_LABELS[value]}
              </option>
            ))}
          </SelectField>
          <SelectField
            aria-label="Filtrer par priorité"
            value={priority}
            onChange={(e) => setPriority(e.target.value as DisputePriority | '')}
          >
            <option value="">Toutes priorités</option>
            {PRIORITY_OPTIONS.map((value) => (
              <option key={value} value={value}>
                {DISPUTE_PRIORITY_LABELS[value]}
              </option>
            ))}
          </SelectField>
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setPriority('');
            }}
            className="mt-3 px-1 text-sm font-semibold text-indigo-600 transition hover:text-indigo-800"
          >
            Réinitialiser les filtres
          </button>
        ) : null}
      </div>

      {isError ? (
        <div className="rounded-2xl bg-rose-50 p-5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
          Impossible de charger les litiges.
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-44" />
          <Skeleton className="h-44" />
          <Skeleton className="hidden h-44 sm:block" />
        </div>
      ) : disputes.length === 0 ? (
        <div className="dispute-pop flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-500">
            <IconInbox size={28} />
          </span>
          <p className="mt-4 text-base font-bold text-slate-900">Aucun litige</p>
          <p className="mt-1 text-sm text-slate-500">
            {hasFilters ? 'Aucun litige ne correspond à ces filtres.' : 'Tout est calme pour le moment.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {disputes.map((dispute, index) => {
            const subject = SUBJECT_STYLE[dispute.subjectType];
            const isShipment = dispute.subjectType === 'SHIPMENT';
            const isAssigned = dispute.assignedAgentId !== null;

            return (
              <div
                key={dispute.id}
                className="dispute-fade-up h-full"
                style={{ animationDelay: `${Math.min(index, 10) * 70 + 120}ms` }}
              >
                <Link
                  href={`/disputes/${dispute.id}`}
                  className="group relative block h-full overflow-hidden rounded-2xl bg-white p-4 pl-6 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.99]"
                >
                  <span
                    className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${PRIORITY_STYLE[dispute.priority].bar}`}
                  />

                  <div className="flex items-start gap-3">
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ${subject.gradient}`}
                    >
                      {isShipment ? <IconPackage size={22} /> : <IconRoute size={22} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
                        {dispute.reason}
                      </h2>
                      <p className="mt-0.5 text-xs font-semibold text-slate-400">
                        {subject.label} · {disputeRef(dispute.id)}
                      </p>
                    </div>
                    <IconChevronRight
                      size={20}
                      className="mt-1 shrink-0 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-500"
                    />
                  </div>

                  {dispute.description ? (
                    <p className="mt-3 line-clamp-2 break-words text-sm leading-relaxed text-slate-600">
                      {dispute.description}
                    </p>
                  ) : null}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusPill status={dispute.status} />
                    <PriorityPill priority={dispute.priority} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-slate-100 pt-3 text-xs">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-semibold ${
                        isAssigned ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      {isAssigned ? <IconUserCheck size={14} /> : <IconUserOff size={14} />}
                      {isAssigned ? 'Assigné' : 'Non assigné'}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-medium text-slate-500">
                      <IconCalendar size={14} />
                      Ouvert le {dateFormatter.format(new Date(dispute.createdAt))}
                    </span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}