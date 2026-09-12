// web-admin/src/app/(app)/notification-templates/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Button, Card, Select, Switch, TextArea, TextField } from '@/components/ui';
import { useCreateNotificationTemplate } from '@/hooks/useNotificationTemplates';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import { ApiError } from '@/services/api/ApiError';
import type { NotificationChannel, NotificationType } from '@/types/notificationTemplates.types';

const TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];
const CHANNELS = Object.keys(NOTIFICATION_CHANNEL_LABELS) as NotificationChannel[];

export default function NewNotificationTemplatePage() {
  const router = useRouter();
  const createTemplate = useCreateNotificationTemplate();

  const [type, setType] = useState<NotificationType>('BOOKING');
  const [channel, setChannel] = useState<NotificationChannel>('PUSH');
  const [locale, setLocale] = useState('fr');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (body.trim().length < 3) {
      setErrorMessage('Renseignez le texte du message.');
      return;
    }

    try {
      const template = await createTemplate.mutateAsync({
        type,
        channel,
        locale,
        subject: channel === 'EMAIL' ? subject.trim() || undefined : undefined,
        body: body.trim(),
        isActive,
      });
      router.replace(`/notification-templates/${template.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/notification-templates" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Créer un modèle</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type d'évènement" value={type} onChange={(e) => setType(e.target.value as NotificationType)}>
              {TYPES.map((value) => (
                <option key={value} value={value}>
                  {NOTIFICATION_TYPE_LABELS[value]}
                </option>
              ))}
            </Select>
            <Select label="Canal" value={channel} onChange={(e) => setChannel(e.target.value as NotificationChannel)}>
              {CHANNELS.map((value) => (
                <option key={value} value={value}>
                  {NOTIFICATION_CHANNEL_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>
          <TextField label="Langue" value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="fr" />
          {channel === 'EMAIL' ? (
            <TextField label="Objet (email uniquement)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          ) : null}
          <TextArea
            label="Texte du message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Votre chauffeur {{driverName}} arrive dans {{eta}} minutes."
            hint="Les {{placeholders}} sont remplacés par les valeurs réelles au moment de l'envoi."
          />
          <Switch checked={isActive} onChange={setIsActive} label="Modèle actif" />

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <Button type="submit" loading={createTemplate.isPending}>
            Créer le modèle
          </Button>
        </form>
      </Card>
    </div>
  );
}
