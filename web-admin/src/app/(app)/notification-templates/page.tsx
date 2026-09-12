// web-admin/src/app/(app)/notification-templates/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { IconPlus } from '@tabler/icons-react';
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui';
import { useNotificationTemplates } from '@/hooks/useNotificationTemplates';
import { NOTIFICATION_CHANNEL_LABELS, NOTIFICATION_TYPE_LABELS } from '@/utils/notificationLabels';

export default function NotificationTemplatesPage() {
  const { data: templates, isLoading, isError } = useNotificationTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Modèles de notification</h1>
          <p className="text-sm text-text-secondary">
            Texte envoyé pour chaque type d&apos;évènement — les <code>{'{{placeholders}}'}</code> sont remplacés au moment de l&apos;envoi.
          </p>
        </div>
        <Link href="/notification-templates/new">
          <Button>
            <IconPlus size={16} />
            Créer un modèle
          </Button>
        </Link>
      </div>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les modèles.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Canal</TableHeaderCell>
              <TableHeaderCell>Langue</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(templates ?? []).map((template) => (
              <TableRow key={template.id} className="hover:bg-surface-muted/50">
                <TableCell>
                  <Link href={`/notification-templates/${template.id}`} className="font-medium text-primary hover:underline">
                    {NOTIFICATION_TYPE_LABELS[template.type]}
                  </Link>
                </TableCell>
                <TableCell className="text-text-secondary">{NOTIFICATION_CHANNEL_LABELS[template.channel]}</TableCell>
                <TableCell className="text-text-secondary">{template.locale}</TableCell>
                <TableCell>
                  <Badge label={template.isActive ? 'Actif' : 'Inactif'} tone={template.isActive ? 'success' : 'neutral'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
