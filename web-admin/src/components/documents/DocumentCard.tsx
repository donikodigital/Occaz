// web-admin/src/components/documents/DocumentCard.tsx
// [25/10/2026] v1 — Carte d'un document de l'entreprise : type de fichier, titre, catégorie, date, fichier, qui l'a déposé, et ses actions
// (ouvrir, enregistrer, modifier, supprimer). Carte ombrée, jamais de tableau.
'use client';

import React from 'react';
import { IconCalendar, IconDownload, IconExternalLink, IconLock, IconPencil, IconPaperclip, IconTrash, IconUser } from '@tabler/icons-react';
import { Chip, CardShell, MetaItem } from '@/components/admin/AdminUi';
import { Button, IconActionButton } from '@/components/ui';
import { CategoryChip, FileKindTile } from '@/components/documents/DocumentParts';
import {
  CATEGORY_TONES,
  FILE_KIND_LABELS,
  fileKindOf,
  formatBytes,
  formatDepositDate,
  formatDocumentDate,
} from '@/utils/companyDocuments';
import type { CompanyDocument } from '@/types/company-documents.types';

export function DocumentCard({
  doc,
  canManage,
  busy,
  onOpen,
  onDownload,
  onEdit,
  onDelete,
}: {
  doc: CompanyDocument;
  /** Le compte a le droit « gérer » : les boutons modifier / supprimer n'apparaissent que sur ses propres dépôts (ou pour le SuperAdmin). */
  canManage: boolean;
  busy: boolean;
  onOpen: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const date = formatDocumentDate(doc.documentDate);
  const showActions = canManage && doc.canChange;

  return (
    <CardShell tone={CATEGORY_TONES[doc.category]} className="p-3.5 pl-5">
      <div className="flex items-start gap-3">
        <FileKindTile contentType={doc.contentType} />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-sm font-semibold leading-snug text-text-primary sm:text-base">{doc.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <CategoryChip category={doc.category} />
            {doc.restricted ? (
              <Chip tone="accent" icon={<IconLock size={12} />}>
                Réservé
              </Chip>
            ) : null}
          </div>
        </div>
      </div>

      {doc.description ? <p className="mt-3 line-clamp-2 text-sm text-text-secondary">{doc.description}</p> : null}

      <div className="mt-3 flex flex-col gap-1">
        <MetaItem icon={<IconCalendar size={15} />}>{date ?? `Déposé le ${formatDepositDate(doc.createdAt)}`}</MetaItem>
        <MetaItem icon={<IconPaperclip size={15} />}>
          {FILE_KIND_LABELS[fileKindOf(doc.contentType)]} · {formatBytes(doc.sizeBytes)} · {doc.fileName}
        </MetaItem>
        <MetaItem icon={<IconUser size={15} />}>
          {doc.uploadedByName ? `${doc.uploadedByName} · ${formatDepositDate(doc.createdAt)}` : `Compte supprimé · ${formatDepositDate(doc.createdAt)}`}
        </MetaItem>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <Button variant="secondary" className="!px-3 !py-1.5" loading={busy} onClick={doc.opensInBrowser ? onOpen : onDownload}>
          {doc.opensInBrowser ? <IconExternalLink size={15} /> : <IconDownload size={15} />}
          {doc.opensInBrowser ? 'Ouvrir' : 'Télécharger'}
        </Button>
        {doc.opensInBrowser ? <IconActionButton icon={IconDownload} label="Enregistrer le fichier" onClick={onDownload} disabled={busy} /> : null}
        {showActions ? (
          <div className="ml-auto flex items-center gap-2">
            <IconActionButton icon={IconPencil} label="Modifier les informations" onClick={onEdit} disabled={busy} />
            <IconActionButton icon={IconTrash} label="Supprimer" tone="danger" onClick={onDelete} disabled={busy} />
          </div>
        ) : null}
      </div>
    </CardShell>
  );
}
