// web-admin/src/app/(app)/notification-templates/new/page.tsx
//
// v2 — Refonte : en-tête avec retour, formulaire en cartes ombrées avec
// aperçu en direct (NotificationTemplateForm, partagé avec la page
// Modifier). Après création, ouverture du modèle créé (comme avant).

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackHeader } from '@/components/admin/AdminUi';
import {
  NotificationTemplateForm,
  type NotificationTemplateFormValues,
} from '@/components/notificationTemplates/NotificationTemplateForm';
import { useCreateNotificationTemplate } from '@/hooks/useNotificationTemplates';
import { ApiError } from '@/services/api/ApiError';

export default function NewNotificationTemplatePage() {
  const router = useRouter();
  const createTemplate = useCreateNotificationTemplate();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(values: NotificationTemplateFormValues) {
    setErrorMessage(undefined);
    try {
      const template = await createTemplate.mutateAsync(values);
      router.replace(`/notification-templates/${template.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader
        href="/notification-templates"
        backLabel="Modèles"
        title="Créer un modèle"
        subtitle="Choisis l’évènement, le canal et écris le message à envoyer."
      />

      <NotificationTemplateForm mode="create" isSubmitting={createTemplate.isPending} errorMessage={errorMessage} onSubmit={handleSubmit} />
    </div>
  );
}