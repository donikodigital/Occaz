// web-admin/src/app/(app)/disputes/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft, IconSend } from '@tabler/icons-react';
import { Badge, Button, Card, Select, TextArea, TextField } from '@/components/ui';
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
  DISPUTE_STATUS_TONE,
} from '@/utils/disputeLabels';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { DisputePriority, DisputeResolutionType, DisputeStatus } from '@/types/disputes.types';

const REVIEWABLE_STATUSES: DisputeStatus[] = [
  'UNDER_REVIEW',
  'WAITING_FOR_CUSTOMER',
  'WAITING_FOR_DRIVER',
  'INVESTIGATION',
];
const RESOLUTION_TYPES = Object.keys(DISPUTE_RESOLUTION_TYPE_LABELS) as DisputeResolutionType[];

function DisputeContext({ subjectType, bookingId, shipmentId }: { subjectType: string; bookingId: string | null; shipmentId: string | null }) {
  const booking = useBookingContext(subjectType === 'TRIP' ? (bookingId ?? undefined) : undefined);
  const shipment = useShipmentContext(subjectType === 'SHIPMENT' ? (shipmentId ?? undefined) : undefined);

  if (subjectType === 'TRIP' && booking.data) {
    return (
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-text-secondary">Réservation concernée</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-text-muted">Montant total</p>
            <p className="font-medium text-text-primary">{formatMoney(booking.data.totalAmount)}</p>
          </div>
          <div>
            <p className="text-text-muted">Places</p>
            <p className="font-medium text-text-primary">{booking.data.seatsCount}</p>
          </div>
          <div>
            <p className="text-text-muted">Statut réservation</p>
            <p className="font-medium text-text-primary">{booking.data.status}</p>
          </div>
        </div>
        {booking.data.passengers && booking.data.passengers.length > 0 ? (
          <div>
            <p className="text-xs text-text-muted">Passagers</p>
            <p className="text-sm text-text-primary">{booking.data.passengers.map((p) => p.fullName).join(', ')}</p>
          </div>
        ) : null}
      </Card>
    );
  }

  if (subjectType === 'SHIPMENT' && shipment.data) {
    return (
      <Card className="space-y-2">
        <h2 className="text-sm font-semibold text-text-secondary">Envoi concerné</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-text-muted">Montant total</p>
            <p className="font-medium text-text-primary">{formatMoney(shipment.data.totalAmount)}</p>
          </div>
          <div>
            <p className="text-text-muted">Catégorie</p>
            <p className="font-medium text-text-primary">{shipment.data.category?.name ?? '—'}</p>
          </div>
          <div>
            <p className="text-text-muted">Expéditeur</p>
            <p className="font-medium text-text-primary">{shipment.data.senderName}</p>
          </div>
          <div>
            <p className="text-text-muted">Destinataire</p>
            <p className="font-medium text-text-primary">{shipment.data.recipientName}</p>
          </div>
          {shipment.data.trip?.driver ? (
            <div>
              <p className="text-text-muted">Chauffeur</p>
              <p className="font-medium text-text-primary">
                {shipment.data.trip.driver.firstName} {shipment.data.trip.driver.lastName}
              </p>
            </div>
          ) : null}
        </div>
      </Card>
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
  const [resolutionType, setResolutionType] = useState<DisputeResolutionType>('NO_ACTION');
  const [refundAmount, setRefundAmount] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolutionError, setResolutionError] = useState<string | undefined>();

  if (isError) return <p className="text-sm text-danger">Litige introuvable.</p>;
  if (isLoading || !dispute) return <p className="text-sm text-text-secondary">Chargement…</p>;

  const isClosed = dispute.status === 'CLOSED';
  const needsRefundAmount = resolutionType === 'PARTIAL_REFUND' || resolutionType === 'SHARED_RESPONSIBILITY';
  const needsTargetUser = resolutionType === 'SUSPENSION';

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
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/disputes" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="flex-1 text-2xl font-semibold text-text-primary">{dispute.reason}</h1>
        <Badge label={DISPUTE_STATUS_LABELS[dispute.status]} tone={DISPUTE_STATUS_TONE[dispute.status]} />
        <Badge label={DISPUTE_PRIORITY_LABELS[dispute.priority]} tone="neutral" />
      </div>

      {dispute.description ? <p className="text-sm text-text-secondary">{dispute.description}</p> : null}

      <DisputeContext subjectType={dispute.subjectType} bookingId={dispute.bookingId} shipmentId={dispute.shipmentId} />

      {!isClosed ? (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text-secondary">Attribution</h2>
          {dispute.assignedAgent ? (
            <p className="text-sm text-text-primary">
              Assigné à <span className="font-medium">{dispute.assignedAgent.email ?? dispute.assignedAgent.phone}</span>
            </p>
          ) : (
            <p className="text-sm text-text-muted">Non assigné.</p>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <Select
              label="Agent"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              className="max-w-xs"
            >
              <option value="">Choisir un agent…</option>
              {(agentsPage?.data ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.email ?? agent.phone}
                </option>
              ))}
            </Select>
            <Select
              label="Priorité"
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as DisputePriority | '')}
              className="max-w-[140px]"
            >
              <option value="">Inchangée</option>
              {Object.entries(DISPUTE_PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            <Button
              disabled={!selectedAgentId}
              loading={assignDispute.isPending}
              onClick={() =>
                assignDispute.mutate({ agentUserId: selectedAgentId, priority: selectedPriority || undefined })
              }
            >
              Assigner
            </Button>
          </div>
        </Card>
      ) : null}

      {!isClosed && dispute.status !== 'RESOLVED' ? (
        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-text-secondary">Statut du traitement</h2>
          <div className="flex flex-wrap gap-2">
            {REVIEWABLE_STATUSES.map((value) => (
              <Button
                key={value}
                variant={dispute.status === value ? 'primary' : 'secondary'}
                className="px-3 py-1.5 text-xs"
                onClick={() => updateStatus.mutate(value)}
                loading={updateStatus.isPending}
              >
                {DISPUTE_STATUS_LABELS[value]}
              </Button>
            ))}
          </div>
        </Card>
      ) : null}

      <Card className="space-y-3">
        <h2 className="text-sm font-semibold text-text-secondary">Messages</h2>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {(dispute.messages ?? []).map((message) => {
            const isMine = message.authorId === currentUserId;
            return (
              <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${isMine ? 'bg-primary text-on-primary' : 'bg-surface-muted text-text-primary'}`}>
                  {message.message}
                </div>
              </div>
            );
          })}
          {(dispute.messages ?? []).length === 0 ? (
            <p className="text-sm text-text-muted">Aucun message pour le moment.</p>
          ) : null}
        </div>
        {!isClosed ? (
          <div className="flex gap-2">
            <TextField
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Écrire un message…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend();
              }}
            />
            <Button onClick={handleSend} loading={addMessage.isPending} disabled={!draft.trim()}>
              <IconSend size={16} />
            </Button>
          </div>
        ) : null}
      </Card>

      {dispute.resolution ? (
        <Card className="space-y-2 border-success bg-success-light">
          <h2 className="text-sm font-semibold text-success-dark">Résolution</h2>
          <p className="text-sm text-text-primary">{DISPUTE_RESOLUTION_TYPE_LABELS[dispute.resolution.type]}</p>
          {dispute.resolution.refundAmount ? (
            <p className="text-sm text-text-secondary">Montant remboursé : {formatMoney(dispute.resolution.refundAmount)}</p>
          ) : null}
          {dispute.resolution.notes ? <p className="text-sm text-text-secondary">{dispute.resolution.notes}</p> : null}
          {dispute.status === 'RESOLVED' ? (
            <Button variant="secondary" onClick={() => closeDispute.mutate()} loading={closeDispute.isPending}>
              Clore le litige
            </Button>
          ) : null}
        </Card>
      ) : !isClosed ? (
        <Card className="space-y-4">
          <h2 className="text-sm font-semibold text-text-secondary">Résoudre le litige</h2>
          <Select label="Type de résolution" value={resolutionType} onChange={(e) => setResolutionType(e.target.value as DisputeResolutionType)}>
            {RESOLUTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {DISPUTE_RESOLUTION_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
          {needsRefundAmount ? (
            <TextField
              label="Montant à rembourser"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="Plus petite unité de la devise"
            />
          ) : null}
          {needsTargetUser ? (
            <TextField
              label="Identifiant de l'utilisateur visé"
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              placeholder="UUID de l'utilisateur"
            />
          ) : null}
          <TextArea
            label="Notes (optionnel)"
            value={resolutionNotes}
            onChange={(e) => setResolutionNotes(e.target.value)}
            rows={3}
          />
          {resolutionError ? <p className="text-sm text-danger">{resolutionError}</p> : null}
          <Button onClick={handleResolve} loading={resolveDispute.isPending}>
            Résoudre le litige
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
