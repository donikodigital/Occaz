// web-admin/src/app/(app)/documents/page.tsx
// [25/10/2026] v1 — Documents de l'entreprise : procès-verbaux de réunion, statuts, contrats… déposés par l'équipe (SuperAdmin et Support).
//  • Une carte par document : type de fichier, titre, catégorie, date (celle de la réunion ou du document), fichier, qui l'a déposé.
//  • Filtre par catégorie (avec le nombre de documents), recherche par titre, nom de fichier ou description.
//  • Ouvrir (PDF, images) ou enregistrer ; ajouter, modifier, supprimer pour ceux qui ont le droit « gérer » — modifier / supprimer seulement
//    ses propres dépôts (le SuperAdmin : tous).
//  • « Réservé » : un document visible du seul SuperAdmin et de la personne qui l'a déposé.
// Cartes ombrées uniquement, jamais de tableau.
'use client';

import React, { useEffect, useState } from 'react';
import { IconFolders, IconUpload } from '@tabler/icons-react';
import { Button } from '@/components/ui';
import { EmptyState, FilterChips, ListSkeleton, Notice, PageHero, SavedNotice, SearchField } from '@/components/admin/AdminUi';
import { DeleteDocumentModal } from '@/components/documents/DeleteDocumentModal';
import { DocumentCard } from '@/components/documents/DocumentCard';
import { EditDocumentModal } from '@/components/documents/EditDocumentModal';
import { UploadDocumentModal } from '@/components/documents/UploadDocumentModal';
import { useCompanyDocumentStats, useCompanyDocuments, useOpenCompanyDocument } from '@/hooks/useCompanyDocuments';
import { usePermissions } from '@/hooks/usePermissions';
import { ApiError } from '@/services/api/ApiError';
import type { CompanyDocument, CompanyDocumentCategory } from '@/types/company-documents.types';
import { CATEGORY_LABELS, CATEGORY_ORDER, formatBytes } from '@/utils/companyDocuments';
import { PERMISSIONS } from '@/utils/permissions';

const SEARCH_DEBOUNCE_MS = 350;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function errorText(error: unknown): string | undefined {
  return error instanceof ApiError ? error.message : undefined;
}

export default function DocumentsPage() {
  const { can } = usePermissions();
  const canManage = can(PERMISSIONS.COMPANY_DOCUMENT_MANAGE);

  const [category, setCategory] = useState<CompanyDocumentCategory | ''>('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);

  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<CompanyDocument | null>(null);
  const [deleting, setDeleting] = useState<CompanyDocument | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useCompanyDocuments({ page, category: category || undefined, search: debouncedSearch || undefined });
  const stats = useCompanyDocumentStats();
  const opener = useOpenCompanyDocument();

  const documents = list.data?.data ?? [];
  const meta = list.data?.meta;

  const changeCategory = (value: CompanyDocumentCategory | '') => {
    setCategory(value);
    setPage(1);
  };

  const open = (doc: CompanyDocument, mode: 'open' | 'download') => {
    setOpenError(null);
    setBusyId(doc.id);
    opener.mutate(
      { doc, mode },
      {
        onError: (error) => setOpenError(errorText(error) ?? "Impossible d'ouvrir ce document."),
        onSettled: () => setBusyId(null),
      },
    );
  };

  const hero = stats.data
    ? [
        { value: String(stats.data.total), label: 'Documents' },
        { value: String(stats.data.byCategory.MEETING_MINUTES), label: 'PV de réunion' },
        { value: formatBytes(stats.data.totalBytes), label: 'Espace utilisé' },
      ]
    : undefined;

  const hasFilter = Boolean(category || debouncedSearch);

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Système"
        title="Documents"
        description="Les procès-verbaux de réunion, statuts, contrats et autres documents importants de l’entreprise, rangés au même endroit et protégés."
        stats={hero}
      />

      {notice ? <SavedNotice>{notice}</SavedNotice> : null}
      {openError ? <Notice tone="danger">{openError}</Notice> : null}
      {list.isError ? <Notice tone="danger">Impossible de lire les documents. {errorText(list.error)}</Notice> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchField
          className="flex-1"
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Rechercher un document…"
          ariaLabel="Rechercher un document"
        />
        {canManage ? (
          <Button onClick={() => setUploading(true)} className="shrink-0">
            <IconUpload size={17} />
            Ajouter un document
          </Button>
        ) : null}
      </div>

      <FilterChips
        value={category}
        onChange={changeCategory}
        allLabel={stats.data ? `Tous (${stats.data.total})` : 'Tous'}
        options={CATEGORY_ORDER.map((key) => ({
          value: key,
          label: stats.data ? `${CATEGORY_LABELS[key]} (${stats.data.byCategory[key]})` : CATEGORY_LABELS[key],
        }))}
      />

      {list.isLoading ? (
        <ListSkeleton count={4} heightClass="h-44" />
      ) : documents.length === 0 ? (
        <EmptyState
          icon={<IconFolders size={28} />}
          title={hasFilter ? 'Aucun document ne correspond' : 'Aucun document pour le moment'}
          text={
            hasFilter
              ? 'Essaie une autre catégorie ou un autre mot de recherche.'
              : canManage
                ? 'Dépose ici le premier procès-verbal, les statuts ou un contrat : ils seront retrouvables en quelques secondes.'
                : 'Les documents déposés par l’équipe apparaîtront ici.'
          }
          action={
            !hasFilter && canManage ? (
              <Button onClick={() => setUploading(true)}>
                <IconUpload size={17} />
                Ajouter un document
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                doc={doc}
                canManage={canManage}
                busy={busyId === doc.id}
                onOpen={() => open(doc, 'open')}
                onDownload={() => open(doc, 'download')}
                onEdit={() => setEditing(doc)}
                onDelete={() => setDeleting(doc)}
              />
            ))}
          </div>

          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>
                Précédent
              </Button>
              <span className="text-sm text-text-secondary">
                Page {meta.page} / {meta.totalPages}
              </span>
              <Button variant="secondary" disabled={page >= meta.totalPages} onClick={() => setPage((current) => current + 1)}>
                Suivant
              </Button>
            </div>
          ) : null}
        </>
      )}

      <UploadDocumentModal
        open={uploading}
        defaultCategory={category || 'MEETING_MINUTES'}
        onClose={() => setUploading(false)}
        onUploaded={(title) => {
          setUploading(false);
          setNotice(`« ${title} » a été ajouté.`);
        }}
      />
      <EditDocumentModal
        doc={editing}
        onClose={() => setEditing(null)}
        onSaved={(title) => {
          setEditing(null);
          setNotice(`« ${title} » a été mis à jour.`);
        }}
      />
      <DeleteDocumentModal
        doc={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(title) => {
          setDeleting(null);
          setNotice(`« ${title} » a été supprimé.`);
        }}
      />
    </div>
  );
}
