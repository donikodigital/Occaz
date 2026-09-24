// web-admin/src/app/(app)/disputes/[id]/page.tsx
// [21/09/2026] v+ — le chauffeur d'un envoi s'affiche aussi quand il n'a pas de trajet (Shipment.driver).
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  IconActivity,
  IconArrowLeft,
  IconCircleCheck,
  IconGavel,
  IconLoader2,
  IconMessageCircle,
  IconPackage,
  IconRoute,
  IconSend,
  IconUserCheck,
  IconUserOff,
  IconUserPlus,
} from '@tabler/icons-react';
import {
  useAddDisputeMessage,
  useAssignDispute,
  useCloseDispute,
  useDispute,
  useResolveDispute,
  useUpdateDisputeStatus,
} from '@/hooks/useDisputes';
import { useBookingContext } from '@/hooks/useBookingContext';
import { useShipmentContext } from '@/hooks/useShipmentContext';
import { useUsersList } from '@/hooks/useUsers';
import { useAuthStore } from '@/stores/authStore';
import {
  DISPUTE_PRIORITY_LABELS,
  DISPUTE_RESOLUTION_TYPE_LABELS,
  DISPUTE_STATUS_LABELS,
} from '@/utils/disputeLabels';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import {
  ActionButton,
  CONTROL_CLASS,
  DisputeMotionStyles,
  InputField,
  Panel,
  PriorityPill,
  STATUS_STYLE,
  SelectField,
  Skeleton,
  StatusPill,
  TextAreaField,
  disputeFont,
  disputeRef,
  initialOf,
} from '@/components/disputes/disputeUi';
import type { DisputePriority, DisputeResolutionType, DisputeStatus } from '@/types/disputes.types';

const REVIEWABLE_STATUSES: DisputeStatus[] = [
  'UNDER_REVIEW',
  'WAITING_FOR_CUSTOMER',
  'WAITING_FOR_DRIVER',
  'INVESTIGATION',
];
const RESOLUTION_TYPES = Object.keys(DISPUTE_RESOLUTION_TYPE_LABELS) as DisputeResolutionType[];

const dateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const messageTimeFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl p-3 ${
        highlight
          ? 'bg-primary-light ring-1 ring-inset ring-primary-accent/40'
          : 'bg-slate-50 ring-1 ring-inset ring-slate-100'
      }`}
    >
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className={`mt-0.5 break-words text-sm font-bold ${highlight ? 'text-primary-dark' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );
}

function DisputeContext({
  subjectType,
  bookingId,
  shipmentId,
}: {
  subjectType: string;
  bookingId: string | null;
  shipmentId: string | null;
}) {
  const booking = useBookingContext(subjectType === 'TRIP' ? (bookingId ?? undefined) : undefined);
  const shipment = useShipmentContext(subjectType === 'SHIPMENT' ? (shipmentId ?? undefined) : undefined);

  if (subjectType === 'TRIP' && booking.data) {
    return (
      <Panel title="Réservation concernée" icon={<IconRoute size={18} />} delay={80}>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Montant total" value={formatMoney(booking.data.totalAmount)} highlight />
          <Stat label="Places" value={booking.data.seatsCount} />
          <Stat label="Statut réservation" value={booking.data.status} />
        </div>
        {booking.data.passengers && booking.data.passengers.length > 0 ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Passagers</p>
            <div className="flex flex-wrap gap-2">
              {booking.data.passengers.map((p, i) => (
                <span
                  key={`${p.fullName}-${i}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                >
                  {p.fullName}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </Panel>
    );
  }

  if (subjectType === 'SHIPMENT' && shipment.data) {
    // Le chauffeur d'un envoi est `driver` (il peut ne pas avoir de trajet) ; `trip.driver` ne sert que de repli.
    const driver = shipment.data.driver ?? shipment.data.trip?.driver;
    return (
      <Panel title="Envoi concerné" icon={<IconPackage size={18} />} delay={80}>
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Montant total" value={formatMoney(shipment.data.totalAmount)} highlight />
          <Stat label="Catégorie" value={shipment.data.category?.name ?? '—'} />
          <Stat label="Expéditeur" value={shipment.data.senderName} />
          <Stat label="Destinataire" value={shipment.data.recipientName} />
          {driver ? <Stat label="Chauffeur" value={`${driver.firstName} ${driver.lastName}`} /> : null}
        </div>
      </Panel>
    );
  }

  return null;
}

export default function DisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const currentUserId = useAuthStore((state) => state.user?.id);
  const { data: dispute, isLoading, isError } = useDispute(id);
  const { data: agentsPage } = useUsersList({ accountType: 'SUPPORT' });

  const addMessage = useAddDisputeMessage(id);
  const assignDispute = useAssignDispute(id);
  const updateStatus = useUpdateDisputeStatus(id);
  const resolveDispute = useResolveDispute(id);
  const closeDispute = useCloseDispute(id);

  const [draft, setDraft] = useState('');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<DisputePriority | ''>('');
  const [pendingStatus, setPendingStatus] = useState<DisputeStatus | null>(null);
  const [resolutionType, setResolutionType] = useState<DisputeResolutionType>('NO_ACTION');
  const [refundAmount, setRefundAmount] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionError, setResolutionError] = useState<string | undefined>();

  if (isError) {
    return (
      <div className={`${disputeFont.className} max-w-3xl`}>
        <div className="rounded-2xl bg-rose-50 p-5 ring-1 ring-rose-200">
          <p className="text-sm font-semibold text-rose-700">Litige introuvable.</p>
          <Link
            href="/disputes"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-rose-700 hover:underline"
          >
            <IconArrowLeft size={16} />
            Retour aux litiges
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !dispute) {
    return (
      <div className={`${disputeFont.className} max-w-3xl space-y-5`}>
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-36" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const isClosed = dispute.status === 'CLOSED';
  const needsRefundAmount = resolutionType === 'PARTIAL_REFUND' || resolutionType === 'SHARED_RESPONSIBILITY';
  const needsTargetUser = resolutionType === 'SUSPENSION';
  const isShipment = dispute.subjectType === 'SHIPMENT';
  const openedByLabel = dispute.openedBy?.email ?? dispute.openedBy?.phone;
  const assignedLabel = dispute.assignedAgent?.email ?? dispute.assignedAgent?.phone;

  function handleSend() {
    const content = draft.trim();
    if (!content) return;
    setDraft('');
    addMessage.mutate(content);
  }

  async function handleResolve() {
    setResolutionError(undefined);
    if (needsRefundAmount && !refundAmount.trim()) {
      setResolutionError('Indiquez le montant à rembourser.');
      return;
    }
    if (needsTargetUser && !targetUserId.trim()) {
      setResolutionError("Indiquez l'identifiant de l'utilisateur visé par la suspension.");
      return;
    }
    try {
      await resolveDispute.mutateAsync({
        type: resolutionType,
        refundAmount: needsRefundAmount ? refundAmount.trim() : undefined,
        targetUserId: needsTargetUser ? targetUserId.trim() : undefined,
        notes: resolutionNotes.trim() || undefined,
      });
    } catch (error) {
      setResolutionError(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className={`${disputeFont.className} max-w-3xl space-y-5 pb-4`}>
      <DisputeMotionStyles />

      {/* ---------- En-tête ---------- */}
      <div className="dispute-fade-up relative overflow-hidden rounded-3xl bg-gradient-ocean p-5 text-white shadow-xl shadow-primary-dark/30">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 left-10 h-32 w-32 rounded-full bg-[#1e9bd7]/20 blur-2xl" />

        <div className="relative space-y-4">
          <div className="flex items-start gap-3">
            <Link
              href="/disputes"
              aria-label="Retour aux litiges"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur-sm transition hover:bg-white/25 active:scale-95"
            >
              <IconArrowLeft size={20} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-sky-100">
                Litige {disputeRef(dispute.id)}
              </p>
              <h1 className="mt-0.5 break-words text-2xl font-extrabold leading-tight tracking-tight">
                {dispute.reason}
              </h1>
              <p className="mt-1 text-xs font-medium text-sky-100">
                Ouvert le {dateFormatter.format(new Date(dispute.createdAt))}
                {openedByLabel ? ` par ${openedByLabel}` : ''}
              </p>
            </div>
          </div>

          {dispute.description ? (
            <p className="rounded-xl bg-white/10 p-3 text-sm leading-relaxed text-sky-50 ring-1 ring-white/15">
              {dispute.description}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={dispute.status} onDark />
            <PriorityPill priority={dispute.priority} onDark />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30 backdrop-blur-sm">
              {isShipment ? <IconPackage size={12} /> : <IconRoute size={12} />}
              {isShipment ? 'Envoi' : 'Trajet'}
            </span>
          </div>
        </div>
      </div>

      <DisputeContext subjectType={dispute.subjectType} bookingId={dispute.bookingId} shipmentId={dispute.shipmentId} />

      {/* ---------- Attribution ---------- */}
      {!isClosed ? (
        <Panel title="Attribution" icon={<IconUserPlus size={18} />} delay={140}>
          {dispute.assignedAgent ? (
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-3 ring-1 ring-inset ring-emerald-100">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-sm font-bold text-white shadow-md shadow-emerald-500/30">
                {initialOf(assignedLabel ?? '?')}
              </span>
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                  <IconUserCheck size={14} />
                  Assigné à
                </p>
                <p className="truncate text-sm font-bold text-slate-900">{assignedLabel}</p>
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
              <IconUserOff size={18} />
              Non assigné
            </div>
          )}

          <div className="flex items-end gap-3">
            <SelectField
              label="Agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="min-w-0 flex-1"
            >
              <option value="">Choisir un agent…</option>
              {(agentsPage?.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.email ?? agent.phone}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Priorité"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as DisputePriority | '')}
              className="w-[8.5rem] shrink-0"
            >
              <option value="">Inchangée</option>
              {Object.entries(DISPUTE_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>

          <ActionButton
            className="mt-4 w-full sm:w-auto"
            disabled={!selectedAgentId}
            loading={assignDispute.isPending}
            onClick={() =>
              assignDispute.mutate({ agentUserId: selectedAgentId, priority: selectedPriority || undefined })
            }
          >
            Assigner
          </ActionButton>
        </Panel>
      ) : null}

      {/* ---------- Statut du traitement ---------- */}
      {!isClosed && dispute.status !== 'RESOLVED' ? (
        <Panel title="Statut du traitement" icon={<IconActivity size={18} />} delay={200}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {REVIEWABLE_STATUSES.map((value) => {
              const active = dispute.status === value;
              const style = STATUS_STYLE[value];
              const pending = pendingStatus === value && updateStatus.isPending;
              return (
                <button
                  key={value}
                  type="button"
                  disabled={updateStatus.isPending}
                  onClick={() => {
                    setPendingStatus(value);
                    updateStatus.mutate(value, { onSettled: () => setPendingStatus(null) });
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-center text-xs font-bold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 ${
                    active
                      ? `bg-gradient-to-br text-white shadow-lg ${style.gradient} ${style.glow}`
                      : 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md'
                  }`}
                >
                  {pending ? <IconLoader2 size={14} className="animate-spin" /> : null}
                  {DISPUTE_STATUS_LABELS[value]}
                </button>
              );
            })}
          </div>
        </Panel>
      ) : null}

      {/* ---------- Messages ---------- */}
      <Panel title="Messages" icon={<IconMessageCircle size={18} />} delay={260}>
        <div className="max-h-80 space-y-3 overflow-y-auto pr-1">
          {(dispute.messages ?? []).map((message) => {
            const isMine = message.authorId === currentUserId;
            const authorLabel = message.author?.email ?? message.author?.phone;
            return (
              <div key={message.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                {!isMine && authorLabel ? (
                  <span className="mb-1 px-1 text-xs font-semibold text-slate-500">{authorLabel}</span>
                ) : null}
                <div
                  className={`max-w-[80%] break-words rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                    isMine
                      ? 'rounded-br-md bg-gradient-ocean text-white shadow-primary-dark/20'
                      : 'rounded-bl-md bg-slate-100 text-slate-900'
                  }`}
                >
                  {message.message}
                </div>
                <span className="mt-1 px-1 text-[11px] text-slate-400">
                  {messageTimeFormatter.format(new Date(message.createdAt))}
                </span>
              </div>
            );
          })}
          {(dispute.messages ?? []).length === 0 ? (
            <div className="flex flex-col items-center rounded-xl bg-slate-50 px-4 py-8 text-center">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                <IconMessageCircle size={22} />
              </span>
              <p className="mt-3 text-sm font-medium text-slate-500">Aucun message pour le moment.</p>
            </div>
          ) : null}
        </div>

        {!isClosed ? (
          <div className="mt-4 flex items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message…"
              className={CONTROL_CLASS}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <button
              type="button"
              aria-label="Envoyer le message"
              onClick={handleSend}
              disabled={!draft.trim() || addMessage.isPending}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-ocean text-white shadow-lg shadow-primary-dark/30 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary-dark/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0"
            >
              {addMessage.isPending ? <IconLoader2 size={18} className="animate-spin" /> : <IconSend size={18} />}
            </button>
          </div>
        ) : null}
      </Panel>

      {/* ---------- Résolution ---------- */}
      {dispute.resolution ? (
        <section
          className="dispute-fade-up rounded-2xl bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-5 shadow-lg shadow-emerald-500/15 ring-1 ring-emerald-200"
          style={{ animationDelay: '320ms' }}
        >
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30">
              <IconCircleCheck size={24} />
            </span>
            <div className="min-w-0">
              <h2 className="text-xs font-bold uppercase tracking-wider text-emerald-700">Résolution</h2>
              <p className="text-base font-bold text-slate-900">
                {DISPUTE_RESOLUTION_TYPE_LABELS[dispute.resolution.type]}
              </p>
            </div>
          </div>

          {dispute.resolution.refundAmount ? (
            <div className="mt-4 rounded-xl bg-white p-3 ring-1 ring-inset ring-emerald-100">
              <p className="text-xs font-medium text-slate-500">Montant remboursé</p>
              <p className="mt-0.5 text-lg font-extrabold text-emerald-700">
                {formatMoney(dispute.resolution.refundAmount)}
              </p>
            </div>
          ) : null}

          {dispute.resolution.notes ? (
            <p className="mt-3 text-sm leading-relaxed text-slate-600">{dispute.resolution.notes}</p>
          ) : null}

          {dispute.status === 'RESOLVED' ? (
            <div className="mt-4">
              <ActionButton variant="secondary" onClick={() => closeDispute.mutate()} loading={closeDispute.isPending}>
                Clore le litige
              </ActionButton>
            </div>
          ) : null}
        </section>
      ) : !isClosed ? (
        <Panel title="Résoudre le litige" icon={<IconGavel size={18} />} delay={320}>
          <div className="space-y-4">
            <SelectField
              label="Type de résolution"
              value={resolutionType}
              onChange={(e) => setResolutionType(e.target.value as DisputeResolutionType)}
            >
              {RESOLUTION_TYPES.map((value) => (
                <option key={value} value={value}>
                  {DISPUTE_RESOLUTION_TYPE_LABELS[value]}
                </option>
              ))}
            </SelectField>

            {needsRefundAmount ? (
              <InputField
                label="Montant à rembourser"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder="Ex. 50000"
                hint="Indique le montant dans la plus petite unité de la devise."
              />
            ) : null}

            {needsTargetUser ? (
              <InputField
                label="Identifiant de l'utilisateur visé"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="UUID de l'utilisateur"
              />
            ) : null}

            <TextAreaField
              label="Notes (optionnel)"
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              rows={3}
            />

            {resolutionError ? (
              <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
                {resolutionError}
              </p>
            ) : null}

            <ActionButton variant="success" className="w-full sm:w-auto" onClick={handleResolve} loading={resolveDispute.isPending}>
              Résoudre le litige
            </ActionButton>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}