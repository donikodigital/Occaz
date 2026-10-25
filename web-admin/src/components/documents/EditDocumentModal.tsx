// web-admin/src/components/documents/EditDocumentModal.tsx
// [25/10/2026] v1 — Modifier les informations d'un document (titre, catégorie, date, description, « Réservé »). Le fichier lui-même ne change pas :
// pour un nouveau fichier, ajouter un nouveau document.
'use client';

import React, { useState } from 'react';
import { Button, Modal } from '@/components/ui';
import { FormError } from '@/components/admin/AdminUi';
import { DocumentFields } from '@/components/documents/DocumentFields';
import { useUpdateCompanyDocument } from '@/hooks/useCompanyDocuments';
import { ApiError } from '@/services/api/ApiError';
import type { CompanyDocument, CompanyDocumentFields } from '@/types/company-documents.types';

function fieldsOf(doc: CompanyDocument): CompanyDocumentFields {
  return {
    title: doc.title,
    category: doc.category,
    documentDate: doc.documentDate ?? '',
    description: doc.description ?? '',
    restricted: doc.restricted,
  };
}

/** Le formulaire est monté à neuf pour chaque document (clé = id) : jamais de reste d'une modification précédente. */
function EditForm({ doc, onClose, onSaved }: { doc: CompanyDocument; onClose: () => void; onSaved: (title: string) => void }) {
  const update = useUpdateCompanyDocument();
  const [fields, setFields] = useState<CompanyDocumentFields>(() => fieldsOf(doc));
  const [error, setError] = useState<string | undefined>();

  const save = () => {
    setError(undefined);
    update.mutate(
      { id: doc.id, fields },
      {
        onSuccess: (saved) => onSaved(saved.title),
        onError: (e) => setError(e instanceof ApiError ? e.message : 'La modification a échoué. Réessaie.'),
      },
    );
  };

  return (
    <Modal
      open
      onClose={update.isPending ? () => undefined : onClose}
      title="Modifier le document"
      description={doc.fileName}
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={update.isPending}>
            Annuler
          </Button>
          <Button onClick={save} loading={update.isPending} disabled={!fields.title.trim()}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <DocumentFields value={fields} onChange={setFields} disabled={update.isPending} />
        <FormError message={error} />
      </div>
    </Modal>
  );
}

export function EditDocumentModal({ doc, onClose, onSaved }: { doc: CompanyDocument | null; onClose: () => void; onSaved: (title: string) => void }) {
  if (!doc) return null;
  return <EditForm key={doc.id} doc={doc} onClose={onClose} onSaved={onSaved} />;
}
