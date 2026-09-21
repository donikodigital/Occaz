// web-admin/src/components/notificationTemplates/NotificationTemplateForm.tsx
//
// Formulaire commun aux pages « Créer » et « Modifier » un modèle de
// notification. En création on choisit l'évènement, le canal et la langue ;
// en modification ces trois-là sont figés (ils identifient le modèle) et
// seuls l'objet (email), le texte et l'état changent. Un aperçu se met à
// jour pendant la frappe, et les {{variables}} du texte sont détectées.

'use client';

import React, { useMemo, useState } from 'react';
import { IconBell, IconMail, IconMessage } from '@tabler/icons-react';
import { Button, Select, TextArea, TextField } from '@/components/ui';
import { Chip, FormError, SavedNotice, SectionCard, SegmentedControl, ToggleRow } from '@/components/admin/AdminUi';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import type { NotificationChannel, NotificationType } from '@/types/notificationTemplates.types';

const TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];
const CHANNELS = Object.keys(NOTIFICATION_CHANNEL_LABELS) as NotificationChannel[];

const PLACEHOLDER_SPLIT = /(\{\{[^}]+\}\})/g;
const PLACEHOLDER_ONLY = /^\{\{\s*([^}\s]+)\s*\}\}$/;

export function channelIcon(channel: NotificationChannel, size = 16): React.ReactNode {
  if (channel === 'SMS') return <IconMessage size={size} />;
  if (channel === 'EMAIL') return <IconMail size={size} />;
  return <IconBell size={size} />;
}

/** Affiche un texte en mettant les {{variables}} en évidence. */
export function PlaceholderText({ text }: { text: string }) {
  const parts = text.split(PLACEHOLDER_SPLIT);
  return (
    <>
      {parts.map((part, index) =>
        PLACEHOLDER_ONLY.test(part) ? (
          <span key={index} className="rounded-md bg-primary/10 px-1 py-0.5 font-mono text-[0.85em] font-semibold text-primary">
            {part}
          </span>
        ) : (
          <React.Fragment key={index}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function extractPlaceholders(text: string): string[] {
  const names = new Set<string>();
  for (const part of text.split(PLACEHOLDER_SPLIT)) {
    const match = PLACEHOLDER_ONLY.exec(part);
    if (match?.[1]) names.add(match[1]);
  }
  return [...names];
}

export interface NotificationTemplateFormValues {
  type: NotificationType;
  channel: NotificationChannel;
  locale: string;
  subject?: string;
  body: string;
  isActive: boolean;
}

interface NotificationTemplateFormProps {
  mode: 'create' | 'edit';
  initial?: {
    type: NotificationType;
    channel: NotificationChannel;
    locale: string;
    subject?: string | null;
    body: string;
    isActive: boolean;
  };
  isSubmitting: boolean;
  errorMessage?: string;
  saved?: boolean;
  onSubmit: (values: NotificationTemplateFormValues) => Promise<void> | void;
}

export function NotificationTemplateForm({
  mode,
  initial,
  isSubmitting,
  errorMessage,
  saved,
  onSubmit,
}: NotificationTemplateFormProps) {
  const [type, setType] = useState<NotificationType>(initial?.type ?? 'BOOKING');
  const [channel, setChannel] = useState<NotificationChannel>(initial?.channel ?? 'PUSH');
  const [locale, setLocale] = useState(initial?.locale ?? 'fr');
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [validationError, setValidationError] = useState<string | undefined>();

  const placeholders = useMemo(() => extractPlaceholders(`${subject} ${body}`), [subject, body]);
  const isEmail = channel === 'EMAIL';

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(undefined);

    if (body.trim().length < 3) {
      setValidationError('Renseignez le texte du message.');
      return;
    }
    if (!locale.trim()) {
      setValidationError('Indiquez la langue du modèle (ex. fr).');
      return;
    }

    await onSubmit({
      type,
      channel,
      locale: locale.trim(),
      subject: isEmail ? subject.trim() || undefined : undefined,
      body: body.trim(),
      isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {mode === 'create' ? (
        <SectionCard title="Quand l’envoyer" description="L’évènement qui déclenche ce message, et par quel canal.">
          <Select label="Type d’évènement" value={type} onChange={(e) => setType(e.target.value as NotificationType)}>
            {TYPES.map((value) => (
              <option key={value} value={value}>
                {NOTIFICATION_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
          <SegmentedControl
            value={channel}
            onChange={setChannel}
            ariaLabel="Canal d’envoi"
            options={CHANNELS.map((value) => ({
              value,
              label: NOTIFICATION_CHANNEL_LABELS[value],
              icon: channelIcon(value),
            }))}
          />
          <TextField label="Langue" value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="fr" hint="Code de langue, ex. fr ou en." />
        </SectionCard>
      ) : (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-surface px-4 py-3 shadow-md">
          <span className="text-xs font-semibold text-text-secondary">Ce modèle est identifié par</span>
          <Chip tone="primary">{NOTIFICATION_TYPE_LABELS[type]}</Chip>
          <Chip tone="neutral" icon={channelIcon(channel, 13)}>
            {NOTIFICATION_CHANNEL_LABELS[channel]}
          </Chip>
          <Chip tone="neutral">{locale.toUpperCase()}</Chip>
        </div>
      )}

      <SectionCard title="Message" description="Les {{variables}} sont remplacées par les valeurs réelles au moment de l’envoi.">
        {isEmail ? <TextField label="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Objet de l’email" /> : null}
        <TextArea
          label="Texte du message"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Votre chauffeur {{driverName}} arrive dans {{eta}} minutes."
        />
        <p className="text-xs text-text-muted">{body.length} caractère{body.length > 1 ? 's' : ''}</p>
        {placeholders.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-text-secondary">Variables utilisées :</span>
            {placeholders.map((name) => (
              <Chip key={name} tone="primary">
                {name}
              </Chip>
            ))}
          </div>
        ) : null}
      </SectionCard>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-md sm:p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span className="text-primary">{channelIcon(channel)}</span>
          Aperçu · {NOTIFICATION_CHANNEL_LABELS[channel]}
        </div>
        <div className="rounded-2xl bg-primary-light/40 p-4">
          {isEmail && subject.trim() ? <p className="mb-1.5 text-sm font-bold text-text-primary">{subject.trim()}</p> : null}
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-primary">
            {body.trim() ? <PlaceholderText text={body} /> : <span className="text-text-muted">Le texte du message apparaîtra ici.</span>}
          </p>
        </div>
      </section>

      <SectionCard title="État">
        <ToggleRow
          checked={isActive}
          onChange={setIsActive}
          label="Modèle actif"
          description="Un modèle inactif n’est plus utilisé pour les envois."
        />
      </SectionCard>

      <FormError message={validationError ?? errorMessage} />
      {saved && mode === 'edit' ? <SavedNotice>Modifications enregistrées.</SavedNotice> : null}

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Créer le modèle' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  );
}