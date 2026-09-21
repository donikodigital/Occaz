// web-admin/src/app/(app)/notification-templates/[id]/page.tsx
//
// v2 — Refonte : même formulaire que la page Créer (NotificationTemplateForm),
// pré-rempli ; l'évènement, le canal et la langue identifient le modèle et ne
// sont pas modifiables. Seuls l'objet (email), le texte et l'état sont
// envoyés à l'API, comme avant.

'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { BackHeader, Chip, Notice } from '@/components/admin/AdminUi';
import {
  NotificationTemplateForm,
  type NotificationTemplateFormValues,
} from '@/components/notificationTemplates/NotificationTemplateForm';
import { useNotificationTemplate, useUpdateNotificationTemplate } from '@/hooks/useNotificationTemplates';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';
import { ApiError } from '@/services/api/ApiError';

export default function EditNotificationTemplatePage() {
  const { id } = useParams<{ id: string }>();
  const { data: template, isLoading, isError } = useNotificationTemplate(id);
  const updateTemplate = useUpdateNotificationTemplate(id);

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(values: NotificationTemplateFormValues) {
    setErrorMessage(undefined);
    setSaved(false);
    try {
      await updateTemplate.mutateAsync({ subject: values.subject, body: values.body, isActive: values.isActive });
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) {
    return (
      <div className="max-w-2xl space-y-6">
        <BackHeader href="/notification-templates" backLabel="Modèles" title="Modèle introuvable" />
        <Notice tone="danger">Ce modèle n’existe plus ou n’a pas pu être chargé.</Notice>
      </div>
    );
  }

  if (isLoading || !template) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-border/50" />
        <div className="h-14 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-48 animate-pulse rounded-2xl bg-border/50" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader
        href="/notification-templates"
        backLabel="Modèles"
        title={NOTIFICATION_TYPE_LABELS[template.type]}
        subtitle={`${NOTIFICATION_CHANNEL_LABELS[template.channel]} · ${template.locale.toUpperCase()}`}
        badge={<Chip tone={template.isActive ? 'success' : 'neutral'}>{template.isActive ? 'Actif' : 'Inactif'}</Chip>}
      />

      <NotificationTemplateForm
        key={template.id}
        mode="edit"
        initial={template}
        isSubmitting={updateTemplate.isPending}
        errorMessage={errorMessage}
        saved={saved}
        onSubmit={handleSubmit}
      />
    </div>
  );
}