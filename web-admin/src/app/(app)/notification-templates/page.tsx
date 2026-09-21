// web-admin/src/app/(app)/notification-templates/page.tsx
//
// v2 — Refonte complète : plus de tableau. Une carte ombrée par modèle :
// canal (icône), évènement, langue, état, et un extrait du message avec ses
// {{variables}} mises en évidence. Filtre par canal, états vide/chargement.

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconBell, IconChevronRight, IconPlus } from '@tabler/icons-react';
import { Chip, EmptyState, FilterChips, LinkButton, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { PlaceholderText, channelIcon } from '@/components/notificationTemplates/NotificationTemplateForm';
import { useNotificationTemplates } from '@/hooks/useNotificationTemplates';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import type { NotificationChannel } from '@/types/notificationTemplates.types';

type TemplateItem = NonNullable<ReturnType<typeof useNotificationTemplates>['data']>[number];

const CHANNEL_OPTIONS = (Object.keys(NOTIFICATION_CHANNEL_LABELS) as NotificationChannel[]).map((value) => ({
  value,
  label: NOTIFICATION_CHANNEL_LABELS[value],
}));

const CLAMP_TWO_LINES: React.CSSProperties = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

function TemplateCard({ template }: { template: TemplateItem }) {
  return (
    <Link
      href={`/notification-templates/${template.id}`}
      className={`group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
        template.isActive ? '' : 'opacity-75'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          {channelIcon(template.channel, 22)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{NOTIFICATION_TYPE_LABELS[template.type]}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Chip tone="neutral">{NOTIFICATION_CHANNEL_LABELS[template.channel]}</Chip>
            <Chip tone="neutral">{template.locale.toUpperCase()}</Chip>
          </div>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      <p className="rounded-xl bg-primary-light/40 px-3 py-2.5 text-sm leading-relaxed text-text-primary" style={CLAMP_TWO_LINES}>
        <PlaceholderText text={template.body} />
      </p>

      <div>
        <Chip tone={template.isActive ? 'success' : 'neutral'}>{template.isActive ? 'Actif' : 'Inactif'}</Chip>
      </div>
    </Link>
  );
}

export default function NotificationTemplatesPage() {
  const { data: templates, isLoading, isError } = useNotificationTemplates();
  const [channel, setChannel] = useState<NotificationChannel | ''>('');

  const all = templates ?? [];
  const activeCount = all.filter((template) => template.isActive).length;

  const filtered = useMemo(
    () =>
      all
        .filter((template) => !channel || template.channel === channel)
        .sort(
          (a, b) =>
            Number(b.isActive) - Number(a.isActive) ||
            NOTIFICATION_TYPE_LABELS[a.type].localeCompare(NOTIFICATION_TYPE_LABELS[b.type]),
        ),
    [all, channel],
  );

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Communication"
        title="Modèles de notification"
        description="Le texte envoyé pour chaque évènement, par canal et par langue. Les {{variables}} sont remplacées au moment de l’envoi."
        stats={[
          { value: templates ? String(all.length) : '…', label: all.length > 1 ? 'modèles' : 'modèle' },
          { value: templates ? String(activeCount) : '…', label: activeCount > 1 ? 'actifs' : 'actif' },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Choisis un modèle pour le modifier.</p>
        <LinkButton href="/notification-templates/new" icon={<IconPlus size={16} />}>
          Créer un modèle
        </LinkButton>
      </div>

      <FilterChips value={channel} onChange={setChannel} options={CHANNEL_OPTIONS} allLabel="Tous les canaux" />

      {isError ? (
        <Notice tone="danger">Impossible de charger les modèles.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-44" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconBell size={26} />}
          title={channel ? 'Aucun modèle pour ce canal' : 'Aucun modèle de notification'}
          text={
            channel
              ? 'Change de canal ou crée un modèle pour celui-ci.'
              : 'Crée le premier modèle : un évènement, un canal, et le texte à envoyer.'
          }
          action={<LinkButton href="/notification-templates/new" icon={<IconPlus size={16} />}>Créer un modèle</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      )}
    </div>
  );
}