// web-admin/src/app/(app)/sos/page.tsx
// [11/10/2026] v1 — Alertes SOS : les alertes actives en haut et en rouge, avec le téléphone de la personne, la carte de sa position et les
// proches enregistrés (à appeler en cas de besoin). La page se rafraîchit toute seule. « J’ai vu » accuse réception, « Clôturer » ferme avec une note.
'use client';

import React, { useState } from 'react';
import {
  IconAlertOctagon,
  IconCalendar,
  IconCheck,
  IconEye,
  IconMapPin,
  IconMessage,
  IconPhone,
  IconUsersGroup,
} from '@tabler/icons-react';
import { Badge, Button, Modal, TextArea } from '@/components/ui';
import { CardShell, EmptyState, FilterSelect, IconTile, ListSkeleton, MetaItem, Notice, PageHero, type Tone } from '@/components/admin/AdminUi';
import { useHandleSos, useSosList } from '@/hooks/useSafety';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/utils/permissions';
import { ApiError } from '@/services/api/ApiError';
import type { SosAlertItem, SosStatus } from '@/types/safety.types';

const STATUS_LABEL: Record<SosStatus, string> = {
  OPEN: 'Nouvelle',
  ACKNOWLEDGED: 'Prise en charge',
  RESOLVED: 'Clôturée',
  CANCELLED: 'Annulée par la personne',
};
const STATUS_TONE: Record<SosStatus, Tone> = {
  OPEN: 'danger',
  ACKNOWLEDGED: 'accent',
  RESOLVED: 'success',
  CANCELLED: 'neutral',
};
const STATUS_OPTIONS = (Object.keys(STATUS_LABEL) as SosStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] }));

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export default function SosPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.SOS_MANAGE);
  const [status, setStatus] = useState<SosStatus | ''>('');
  const { data, isLoading, isError } = useSosList({ status: status || undefined });
  const handle = useHandleSos();
  const [closing, setClosing] = useState<SosAlertItem | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | undefined>();

  const alerts = data?.data ?? [];
  const total = data?.meta.total;
  const activeCount = alerts.filter((alert) => alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED').length;

  function fail(err: unknown) {
    setError(err instanceof ApiError ? err.message : 'Impossible d’enregistrer pour le moment.');
  }

  function acknowledge(alert: SosAlertItem) {
    setError(undefined);
    handle.mutate({ id: alert.id, payload: { status: 'ACKNOWLEDGED' } }, { onError: fail });
  }

  function confirmClose() {
    if (!closing) return;
    setError(undefined);
    handle.mutate(
      { id: closing.id, payload: { status: 'RESOLVED', resolutionNote: note.trim() || undefined } },
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
        title="Alertes SOS"
        description="Alertes déclenchées depuis l’application. Appelle la personne en priorité, puis ses proches si elle ne répond pas."
        stats={[
          { value: data ? String(activeCount) : '…', label: 'en cours' },
          { value: total !== undefined ? String(total) : '…', label: total === 1 ? 'alerte' : 'alertes' },
        ]}
      />

      <div className="sm:max-w-xs">
        <FilterSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Tous les statuts" ariaLabel="Filtrer par statut" />
      </div>

      {error ? <Notice tone="danger">{error}</Notice> : null}

      {isError ? (
        <Notice tone="danger">Impossible de charger les alertes.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={3} heightClass="h-56" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : alerts.length === 0 ? (
        <EmptyState
          icon={<IconAlertOctagon size={26} />}
          title="Aucune alerte"
          text={status ? 'Aucune alerte avec ce statut.' : 'Aucune alerte SOS pour le moment.'}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {alerts.map((alert) => {
            const isActive = alert.status === 'OPEN' || alert.status === 'ACKNOWLEDGED';
            return (
              <CardShell key={alert.id} tone={STATUS_TONE[alert.status]} muted={!isActive} className="p-3.5 pl-5">
                <div className="flex items-start gap-3">
                  <IconTile tone={STATUS_TONE[alert.status]}>
                    <IconAlertOctagon size={20} />
                  </IconTile>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-semibold leading-snug text-text-primary">{alert.user.name}</h2>
                    <p className="mt-0.5 text-xs text-text-muted">{dateFormatter.format(new Date(alert.createdAt))}</p>
                  </div>
                  <Badge label={STATUS_LABEL[alert.status]} tone={STATUS_TONE[alert.status]} />
                </div>

                <div className="mt-3 space-y-1.5">
                  <a href={`tel:${alert.user.phone}`} className="block">
                    <MetaItem icon={<IconPhone size={15} />}>
                      <span className="font-semibold text-primary">{alert.user.phone}</span>
                    </MetaItem>
                  </a>
                  {alert.mapUrl ? (
                    <a href={alert.mapUrl} target="_blank" rel="noopener noreferrer" className="block">
                      <MetaItem icon={<IconMapPin size={15} />}>
                        <span className="font-semibold text-primary">Voir la position sur la carte</span>
                      </MetaItem>
                    </a>
                  ) : (
                    <MetaItem icon={<IconMapPin size={15} />}>Position non transmise</MetaItem>
                  )}
                  <MetaItem icon={<IconUsersGroup size={15} />}>
                    {alert.user.emergencyContacts.length === 0
                      ? 'Aucun proche enregistré'
                      : `${alert.contactsNotified} proche(s) prévenu(s) sur ${alert.user.emergencyContacts.length}`}
                  </MetaItem>
                </div>

                {alert.message ? (
                  <p className="mt-2.5 flex gap-2 break-words rounded-xl bg-surface-muted p-2.5 text-sm text-text-secondary">
                    <IconMessage size={16} className="mt-0.5 shrink-0 text-text-muted" />« {alert.message} »
                  </p>
                ) : null}

                {alert.user.emergencyContacts.length > 0 && isActive ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {alert.user.emergencyContacts.map((contact) => (
                      <a
                        key={contact.phone}
                        href={`tel:${contact.phone}`}
                        className="inline-flex items-center gap-1.5 rounded-full bg-primary-light px-2.5 py-1 text-xs font-semibold text-primary-dark"
                      >
                        <IconPhone size={13} />
                        {contact.name}
                      </a>
                    ))}
                  </div>
                ) : null}

                {alert.resolutionNote ? <p className="mt-2 break-words text-xs text-text-muted">Note : {alert.resolutionNote}</p> : null}

                {canManage && isActive ? (
                  <div className="mt-3 flex flex-wrap gap-2 border-t border-border/70 pt-2.5">
                    {alert.status === 'OPEN' ? (
                      <Button type="button" variant="secondary" onClick={() => acknowledge(alert)} loading={handle.isPending}>
                        <IconEye size={16} />
                        J’ai vu
                      </Button>
                    ) : null}
                    <Button type="button" variant="success" onClick={() => setClosing(alert)}>
                      <IconCheck size={16} />
                      Clôturer
                    </Button>
                  </div>
                ) : (
                  <p className="mt-3 inline-flex items-center gap-1.5 border-t border-border/70 pt-2.5 text-xs text-text-muted">
                    <IconCalendar size={14} />
                    {alert.handledAt ? `Terminée le ${dateFormatter.format(new Date(alert.handledAt))}` : 'En attente'}
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
        title="Clôturer l’alerte"
        description={closing ? `SOS de ${closing.user.name}` : undefined}
        footer={
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setClosing(null)}>
              Annuler
            </Button>
            <Button type="button" onClick={confirmClose} loading={handle.isPending}>
              Clôturer
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
          placeholder="Ex. : personne jointe au téléphone, tout va bien."
        />
      </Modal>
    </div>
  );
}
