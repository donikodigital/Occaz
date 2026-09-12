// web-admin/src/app/(app)/notification-templates/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Button, Card, Switch, TextArea, TextField } from '@/components/ui';
import { useNotificationTemplate, useUpdateNotificationTemplate } from '@/hooks/useNotificationTemplates';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import { ApiError } from '@/services/api/ApiError';

export default function EditNotificationTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading, isError } = useNotificationTemplate(id);
  const updateTemplate = useUpdateNotificationTemplate(id);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!template) return;
    setSubject(template.subject ?? '');
    setBody(template.body);
    setIsActive(template.isActive);
  }, [template]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSaved(false);

    try {
      await updateTemplate.mutateAsync({
        subject: template?.channel === 'EMAIL' ? subject.trim() || undefined : undefined,
        body: body.trim(),
        isActive,
      });
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) return <p className="text-sm text-danger">Modèle introuvable.</p>;
  if (isLoading || !template) return <p className="text-sm text-text-secondary">Chargement…</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/notification-templates" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{NOTIFICATION_TYPE_LABELS[template.type]}</h1>
          <p className="text-xs text-text-muted">
            {NOTIFICATION_CHANNEL_LABELS[template.channel]} · {template.locale}
          </p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {template.channel === 'EMAIL' ? (
            <TextField label="Objet" value={subject} onChange={(e) => setSubject(e.target.value)} />
          ) : null}
          <TextArea
            label="Texte du message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            hint="Les {{placeholders}} sont remplacés par les valeurs réelles au moment de l'envoi."
          />
          <Switch checked={isActive} onChange={setIsActive} label="Modèle actif" />

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          {saved ? <p className="text-sm text-success-dark">Modifications enregistrées.</p> : null}

          <Button type="submit" loading={updateTemplate.isPending}>
            Enregistrer les modifications
          </Button>
        </form>
      </Card>
    </div>
  );
}
