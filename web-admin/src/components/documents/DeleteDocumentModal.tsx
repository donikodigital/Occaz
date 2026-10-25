// web-admin/src/components/documents/DeleteDocumentModal.tsx
// [25/10/2026] v1 — Confirmation avant de supprimer un document : la suppression est définitive (la fiche ET le fichier).
'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { FormError } from '@/components/admin/AdminUi';
import { useDeleteCompanyDocument } from '@/hooks/useCompanyDocuments';
import { ApiError } from '@/services/api/ApiError';
import type { CompanyDocument } from '@/types/company-documents.types';

function DeleteForm({ doc, onClose, onDeleted }: { doc: CompanyDocument; onClose: () => void; onDeleted: (title: string) => void }) {
  const remove = useDeleteCompanyDocument();
  const [error, setError] = useState<string | undefined>();

  const confirm = () => {
    setError(undefined);
    remove.mutate(doc.id, {
      onSuccess: () => onDeleted(doc.title),
      onError: (e) => setError(e instanceof ApiError ? e.message : 'La suppression a échoué. Réessaie.'),
    });
  };

  return (
    <Modal
      open
      onClose={remove.isPending ? () => undefined : onClose}
      title="Supprimer ce document ?"
      size="sm"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={remove.isPending}>
            Annuler
          </Button>
          <Button variant="danger" onClick={confirm} loading={remove.isPending}>
            Supprimer définitivement
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-sm text-text-secondary">
        <p>
          <span className="font-semibold text-text-primary">« {doc.title} »</span> et son fichier seront effacés. Cette action est
          définitive : il n’y a pas de corbeille.
        </p>
        <FormError message={error} />
      </div>
    </Modal>
  );
}

export function DeleteDocumentModal({ doc, onClose, onDeleted }: { doc: CompanyDocument | null; onClose: () => void; onDeleted: (title: string) => void }) {
  if (!doc) return null;
  return <DeleteForm key={doc.id} doc={doc} onClose={onClose} onDeleted={onDeleted} />;
}
