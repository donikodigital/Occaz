// web-admin/src/app/(app)/reports/page.tsx
// [11/10/2026] v1 — Signalements d'utilisateurs : cartes ombrées (jamais de tableau), le plus récent en premier. L'essentiel est sur la carte
// (motif, qui signale qui, combien de fois la personne a été signalée) ; la prise en charge se fait en un clic, la clôture avec une note.
'use client';

import React, { useState } from 'react';
import { IconCalendar, IconCheck, IconEye, IconFlag3, IconPhone, IconUser, IconX } from '@tabler/icons-react';
import { Badge, Button, Modal, TextArea } from '@/components/ui';
import { EmptyState, FilterSelect, IconTile, CardShell, ListSkeleton, MetaItem, Notice, PageHero, type Tone } from '@/components/admin/AdminUi';
import { useReportsList, useUpdateReport } from '@/hooks/useSafety';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/utils/permissions';
import { ApiError } from '@/services/api/ApiError';
import type { UserReportItem, UserReportStatus } from '@/types/safety.types';

const STATUS_LABEL: Record<UserReportStatus, string> = {
  OPEN: 'À traiter',
  IN_REVIEW: 'En cours',
  RESOLVED: 'Traité',
  DISMISSED: 'Rejeté',
};
const STATUS_TONE: Record<UserReportStatus, Tone> = {
  OPEN: 'danger',
  IN_REVIEW: 'accent',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
};
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as UserReportStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] }));

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

type Closing = { report: UserReportItem; status: 'RESOLVED' | 'DISMISSED' };

export default function ReportsPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.USER_REPORT_MANAGE);
  const [status, setStatus] = useState<UserReportStatus | ''>('');
  const { data, isLoading, isError } = useReportsList({ status: status || undefined });
  const update = useUpdateReport();
  const [closing, setClosing] = useState<Closing | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  const reports = data?.data ?? [];
  const total = data?.meta.total;

  function fail(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Impossible d’enregistrer pour le moment.');
  }

  function takeCharge(report: UserReportItem) {
    setError(undefined);
    update.mutate({ id: report.id, payload: { status: 'IN_REVIEW' } }, { onError: fail });
  }

  function confirmClose() {
    if (!closing) return;
    setError(undefined);
    update.mutate(
      { id: closing.report.id, payload: { status: closing.status, resolutionNote: note.trim() || undefined } },
      {
        onSuccess: () => {
          setClosing(null);
          setNote('');
        },
        onError: fail,
      },
    );
  }

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Sécurité"
        title="Signalements"
        description="Utilisateurs signalés par d’autres utilisateurs : examine, puis clôture avec une note."
        stats={[{ value: total !== undefined ? String(total) : '…', label: total === 1 ? 'signalement' : 'signalements' }]}
      />

      <div className="sm:max-w-xs">
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Tous les statuts" ariaLabel="Filtrer par statut" />
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {isError ? (
        <Notice tone="danger">Impossible de charger les signalements.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-48" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : reports.length === 0 ? (
        <EmptyState
          icon={<IconFlag3 size={26} />}
          title="Aucun signalement"
          text={status ? 'Aucun signalement avec ce statut.' : 'Rien à traiter pour le moment.'}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {reports.map((report) => {
            const isClosed = report.status === 'RESOLVED' || report.status === 'DISMISSED';
            return (
              <CardShell key={report.id} tone={STATUS_TONE[report.status]} className="p-3.5 pl-5">
                <div className="flex items-start gap-3">
                  <IconTile tone={STATUS_TONE[report.status]}>
                    <IconFlag3 size={20} />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold leading-snug text-text-primary">{report.reasonLabel}</h2>
                    <p className="mt-0.5 text-xs text-text-muted">{dateFormatter.format(new Date(report.createdAt))}</p>
                  </div>
                  <Badge label={STATUS_LABEL[report.status]} tone={STATUS_TONE[report.status]} />
                </div>

                <div className="mt-3 space-y-1.5">
                  <MetaItem icon={<IconUser size={15} />}>
                    <strong className="font-semibold text-text-primary">{report.reportedUser.name}</strong>
                    {' · '}
                    {report.reportedUser.accountType === 'DRIVER' ? 'conducteur' : 'client'}
                  </MetaItem>
                  <MetaItem icon={<IconPhone size={15} />}>{report.reportedUser.phone}</MetaItem>
                  <MetaItem icon={<IconEye size={15} />}>Signalé par {report.reporter.name}</MetaItem>
                </div>

                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {report.reportedUser.reportCount > 1 ? (
                    <Badge label={`Signalé ${report.reportedUser.reportCount} fois`} tone="danger" />
                  ) : null}
                  {report.reportedUser.isSuspended ? <Badge label="Compte suspendu" tone="neutral" /> : null}
                </div>

                {report.details ? <p className="mt-2.5 break-words rounded-xl bg-surface-muted p-2.5 text-sm text-text-secondary">« {report.details} »</p> : null}
                {report.resolutionNote ? (
                  <p className="mt-2 break-words text-xs text-text-muted">Note : {report.resolutionNote}</p>
                ) : null}

                {canManage && !isClosed ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-2.5">
                    {report.status === 'OPEN' ? (
                      <Button type="button" variant="secondary" onClick={() => takeCharge(report)} loading={update.isPending}>
                        Prendre en charge
                      </Button>
                    ) : null}
                    <Button type="button" variant="success" onClick={() => setClosing({ report, status: 'RESOLVED' })}>
                      <IconCheck size={16} />
                      Traité
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => setClosing({ report, status: 'DISMISSED' })}>
                      <IconX size={16} />
                      Rejeter
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-1.5 border-t border-border/70 pt-2.5 text-xs text-text-muted">
                    <IconCalendar size={14} />
                    {report.handledAt ? `Clôturé le ${dateFormatter.format(new Date(report.handledAt))}` : 'En attente de traitement'}
                  </p>
                )}
              </CardShell>
            );
          })}
        </div>
      )}

      <Modal
        open={closing !== null}
        onClose={() => setClosing(null)}
        title={closing?.status === 'RESOLVED' ? 'Marquer comme traité' : 'Rejeter le signalement'}
        description={closing ? `${closing.report.reasonLabel} — ${closing.report.reportedUser.name}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setClosing(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={confirmClose} loading={update.isPending}>
              Confirmer
            </Button>
          </div>
        }
      >
        <TextArea
          label="Note (facultative)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="Ex. : compte averti par téléphone, aucun autre signalement."
        />
      </Modal>
    </div>
  );
}
