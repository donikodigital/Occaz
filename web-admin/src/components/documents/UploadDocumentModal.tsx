// web-admin/src/components/documents/UploadDocumentModal.tsx
// [25/10/2026] v1 — Ajouter un document : choisir (ou glisser) le fichier, renseigner titre / catégorie / date, puis envoi avec barre de progression.
// Le fichier part directement vers le stockage ; seule la fiche passe par notre serveur (voir services/api/company-documents.api.ts).
'use client';

import React, { useRef, useState } from 'react';
import { IconCloudUpload, IconRefresh } from '@tabler/icons-react';
import { Button, Modal } from '@/components/ui';
import { FormError } from '@/components/admin/AdminUi';
import { DocumentFields } from '@/components/documents/DocumentFields';
import { FileKindTile } from '@/components/documents/DocumentParts';
import { useUploadCompanyDocument } from '@/hooks/useCompanyDocuments';
import { ApiError } from '@/services/api/ApiError';
import type { CompanyDocumentCategory, CompanyDocumentFields } from '@/types/company-documents.types';
import { ACCEPTED_FORMATS_TEXT, FILE_INPUT_ACCEPT, MAX_DOCUMENT_BYTES, formatBytes, resolveContentType, titleFromFileName } from '@/utils/companyDocuments';

function emptyFields(category: CompanyDocumentCategory): CompanyDocumentFields {
  return { title: '', category, documentDate: '', description: '', restricted: false };
}

interface UploadProps {
  /** Catégorie préchoisie (celle du filtre actif). */
  defaultCategory: CompanyDocumentCategory;
  onClose: () => void;
  onUploaded: (title: string) => void;
}

function UploadForm({ defaultCategory, onClose, onUploaded }: UploadProps) {
  const upload = useUploadCompanyDocument();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fields, setFields] = useState<CompanyDocumentFields>(() => emptyFields(defaultCategory));
  const [fileError, setFileError] = useState<string | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const busy = upload.isPending;
  const contentType = file ? resolveContentType(file) : null;

  const choose = (candidate: File | undefined) => {
    if (!candidate) return;
    setError(undefined);
    if (!resolveContentType(candidate)) {
      setFile(null);
      setFileError(`Ce type de fichier n'est pas accepté. Formats : ${ACCEPTED_FORMATS_TEXT}.`);
      return;
    }
    if (candidate.size <= 0) {
      setFile(null);
      setFileError('Ce fichier est vide.');
      return;
    }
    if (candidate.size > MAX_DOCUMENT_BYTES) {
      setFile(null);
      setFileError(`Ce fichier fait ${formatBytes(candidate.size)} : la limite est de 25 Mo.`);
      return;
    }
    setFileError(undefined);
    setFile(candidate);
    // Titre proposé à partir du nom du fichier, sans écraser ce que la personne a déjà tapé.
    setFields((current) => (current.title.trim() ? current : { ...current, title: titleFromFileName(candidate.name) }));
  };

  const canSubmit = Boolean(file && contentType && fields.title.trim());

  const submit = () => {
    if (!file || !contentType) return;
    setError(undefined);
    setProgress(0);
    upload.mutate(
      { file, contentType, fields, onProgress: setProgress },
      {
        onSuccess: (doc) => onUploaded(doc.title),
        onError: (e) => setError(e instanceof ApiError ? e.message : "L'ajout a échoué. Réessaie."),
      },
    );
  };

  const saving = busy && progress >= 100;

  return (
    <Modal
      open
      onClose={busy ? () => undefined : onClose}
      title="Ajouter un document"
      description="PV de réunion, statuts, contrats… rangés ici, à l'abri."
      size="lg"
      footer={
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Annuler
          </Button>
          <Button onClick={submit} loading={busy} disabled={!canSubmit}>
            {saving ? 'Enregistrement…' : busy ? `Envoi ${progress} %` : 'Ajouter le document'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept={FILE_INPUT_ACCEPT} className="hidden" onChange={(event) => choose(event.target.files?.[0])} />

        {file && contentType ? (
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface-muted/60 p-3">
            <FileKindTile contentType={contentType} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text-primary">{file.name}</p>
              <p className="text-xs text-text-secondary">{formatBytes(file.size)}</p>
            </div>
            <Button variant="secondary" className="!px-3 !py-1.5" onClick={() => inputRef.current?.click()} disabled={busy}>
              <IconRefresh size={15} />
              Changer
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              choose(event.dataTransfer.files?.[0]);
            }}
            className={`flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition ${
              dragging ? 'border-primary bg-primary-light' : 'border-border bg-surface hover:border-primary/50'
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-primary">
              <IconCloudUpload size={26} />
            </span>
            <span className="text-sm font-semibold text-text-primary">Choisir un fichier ou le glisser ici</span>
            <span className="text-xs text-text-secondary">{ACCEPTED_FORMATS_TEXT}</span>
          </button>
        )}
        <FormError message={fileError} />

        {busy ? (
          <div aria-label="Progression de l'envoi">
            <div className="h-2 overflow-hidden rounded-full bg-primary-light">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : null}

        <DocumentFields value={fields} onChange={setFields} disabled={busy} />
        <FormError message={error} />
      </div>
    </Modal>
  );
}

/** Le formulaire est monté à neuf à chaque ouverture : on ne retrouve jamais le brouillon d'un envoi précédent. */
export function UploadDocumentModal({ open, ...props }: UploadProps & { open: boolean }) {
  if (!open) return null;
  return <UploadForm {...props} />;
}
