// web-admin/src/components/layout/DocumentsPanel.tsx
'use client';

import React, { useState } from 'react';
import { IconCheck, IconEye, IconFileText, IconX } from '@tabler/icons-react';
import { Badge, Button, IconActionButton, TextArea } from '@/components/ui';
import { useDocumentsForOwner, useRejectDocument, useVerifyDocument } from '@/hooks/useDocuments';
import { documentsApi } from '@/services/api/documents.api';
import type { AppDocument, DocumentOwnerType } from '@/types/documents.types';

const STATUS_TONE: Record<AppDocument['status'], 'success' | 'danger' | 'accent'> = {
  VERIFIED: 'success',
  REJECTED: 'danger',
  PENDING: 'accent',
};
const STATUS_LABEL: Record<AppDocument['status'], string> = {
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté',
  PENDING: 'En attente',
};

function DocumentRow({ document, ownerType, ownerId }: { document: AppDocument; ownerType: DocumentOwnerType; ownerId: string }) {
  const verify = useVerifyDocument(ownerType, ownerId);
  const reject = useRejectDocument(ownerType, ownerId);
  const [isViewing, setViewing] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [reason, setReason] = useState('');

  async function handleView() {
    setViewing(true);
    try {
      const { url } = await documentsApi.getDownloadUrl(document.id);
      window.open(url, '_blank', 'noopener,noreferrer');
    } finally {
      setViewing(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
            <IconFileText size={15} className="text-text-secondary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{document.type}</p>
            <p className="text-xs text-text-muted">
              {new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(document.createdAt))}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge label={STATUS_LABEL[document.status]} tone={STATUS_TONE[document.status]} />
          <IconActionButton icon={IconEye} label="Voir le document" onClick={handleView} loading={isViewing} />
          {document.status === 'PENDING' ? (
            <>
              <IconActionButton
                icon={IconCheck}
                label="Valider le document"
                tone="success"
                onClick={() => verify.mutate(document.id)}
                loading={verify.isPending}
              />
              <IconActionButton icon={IconX} label="Rejeter le document" tone="danger" onClick={() => setShowRejectForm((v) => !v)} />
            </>
          ) : null}
        </div>
      </div>

      {document.status === 'REJECTED' && document.rejectionReason ? (
        <p className="mt-2 rounded-md bg-danger-light p-2 text-xs text-danger-dark">Motif : {document.rejectionReason}</p>
      ) : null}

      {showRejectForm ? (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          <TextArea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motif du rejet…"
            rows={2}
          />
          <Button
            variant="danger"
            className="px-3 py-1.5 text-xs"
            disabled={!reason.trim()}
            loading={reject.isPending}
            onClick={() => {
              reject.mutate({ id: document.id, reason: reason.trim() });
              setShowRejectForm(false);
              setReason('');
            }}
          >
            Confirmer le rejet
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function DocumentsPanel({ ownerType, ownerId }: { ownerType: DocumentOwnerType; ownerId: string }) {
  const { data: documents, isLoading, isError } = useDocumentsForOwner(ownerType, ownerId);

  if (isError) return <p className="text-sm text-danger">Impossible de charger les documents.</p>;
  if (isLoading) return <p className="text-sm text-text-secondary">Chargement…</p>;

  return (
    <div className="space-y-2">
      {documents && documents.length > 0 ? (
        documents.map((document) => (
          <DocumentRow key={document.id} document={document} ownerType={ownerType} ownerId={ownerId} />
        ))
      ) : (
        <p className="text-sm text-text-muted">Aucun document envoyé pour le moment.</p>
      )}
    </div>
  );
}