// web-admin/src/app/(app)/reports/page.tsx
// [16/10/2026] v2 — « Envoyer un rappel » : message du service client à la personne signalée (ou à celle qui a signalé), depuis la carte.
// [11/10/2026] v1 — Signalements d'utilisateurs : cartes ombrées (jamais de tableau), le plus récent en premier. L'essentiel est sur la carte
// (motif, qui signale qui, combien de fois la personne a été signalée) ; la prise en charge se fait en un clic, la clôture avec une note.
'use client';

import React, { useState } from 'react';
import { IconBell, IconCalendar, IconCheck, IconEye, IconFlag3, IconPhone, IconUser, IconX } from '@tabler/icons-react';
import { Badge, Button, Modal, Select, TextArea } from '@/components/ui';
import { EmptyState, FilterSelect, IconTile, CardShell, ListSkeleton, MetaItem, Notice, PageHero, SavedNotice, type Tone } from '@/components/admin/AdminUi';
import { useReportsList, useRemindReport, useUpdateReport } from '@/hooks/useSafety';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/utils/permissions';
import { ApiError } from '@/services/api/ApiError';
import type { ReportReminderRecipient, UserReportItem, UserReportStatus } from '@/types/safety.types';

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

const REMINDER_MIN_LENGTH = 10;
const REMINDER_DEFAULTS: Record<ReportReminderRecipient, string> = {
  REPORTED:
    'Rappel du service client Occa’Z : merci de respecter les autres utilisateurs. Un nouveau signalement pourra entraîner la suspension de votre compte.',
  REPORTER: 'Merci pour votre signalement. Notre équipe l’a examiné et les mesures nécessaires ont été prises.',
};

export default function ReportsPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.USER_REPORT_MANAGE);
  const [status, setStatus] = useState<UserReportStatus | ''>('');
  const { data, isLoading, isError } = useReportsList({ status: status || undefined });
  const update = useUpdateReport();
  const remind = useRemindReport();
  const [closing, setClosing] = useState<Closing | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [reminding, setReminding] = useState<UserReportItem | null>(null);
  const [recipient, setRecipient] = useState<ReportReminderRecipient>('REPORTED');
  const [reminderText, setReminderText] = useState('');
  const [reminderSent, setReminderSent] = useState<string | undefined>();

  const reports = data?.data ?? [];
  const total = data?.meta.total;

  function fail(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Impossible d’enregistrer pour le moment.');
  }

  function takeCharge(report: UserReportItem) {
    setError(undefined);
    update.mutate({ id: report.id, payload: { status: 'IN_REVIEW' } }, { onError: fail });
  }

  function openReminder(report: UserReportItem) {
    setError(undefined);
    setReminderSent(undefined);
    setRecipient('REPORTED');
    setReminderText(REMINDER_DEFAULTS.REPORTED);
    setReminding(report);
  }

  function changeRecipient(next: ReportReminderRecipient) {
    // Le texte proposé suit le destinataire tant que l'agent ne l'a pas modifié.
    if (reminderText === REMINDER_DEFAULTS[recipient]) setReminderText(REMINDER_DEFAULTS[next]);
    setRecipient(next);
  }

  function sendReminder() {
    if (!reminding) return;
    setError(undefined);
    remind.mutate(
      { id: reminding.id, payload: { recipient, message: reminderText.trim() } },
      {
        onSuccess: () => {
          setReminderSent(`Rappel envoyé à ${recipient === 'REPORTED' ? reminding.reportedUser.name : reminding.reporter.name}.`);
          setReminding(null);
        },
        onError: fail,
      },
    );
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
      {reminderSent ? <SavedNotice>{reminderSent}</SavedNotice> : null}

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
                    <Button type="button" variant="secondary" onClick={() => openReminder(report)}>
                      <IconBell size={16} />
                      Envoyer un rappel
                    </Button>
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
        open={reminding !== null}
        onClose={() => setReminding(null)}
        title="Envoyer un rappel"
        description={reminding ? `${reminding.reasonLabel} — ${reminding.reportedUser.name}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setReminding(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={sendReminder} loading={remind.isPending} disabled={reminderText.trim().length < REMINDER_MIN_LENGTH}>
              Envoyer
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Select label="Destinataire" value={recipient} onChange={(event) => changeRecipient(event.target.value as ReportReminderRecipient)}>
            <option value="REPORTED">{reminding ? `La personne signalée — ${reminding.reportedUser.name}` : 'La personne signalée'}</option>
            <option value="REPORTER">{reminding ? `La personne qui a signalé — ${reminding.reporter.name}` : 'La personne qui a signalé'}</option>
          </Select>
          <TextArea
            label="Message"
            value={reminderText}
            onChange={(event) => setReminderText(event.target.value)}
            rows={5}
            maxLength={500}
            hint="Le message s’affiche dans les notifications de l’application."
          />
        </div>
      </Modal>

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
