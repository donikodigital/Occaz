// web-admin/src/app/(app)/translations/page.tsx
//
// v2 — Refonte complète : plus de tableau ni de formulaire à cinq champs
// posé en permanence en haut de page.
//   - Les traductions sont regroupées par enregistrement : une carte par
//     (type d'entité, id) qui liste ses champs et ses langues ;
//   - « Ajouter » ouvre une modale ; depuis une carte, le type et l'id sont
//     déjà remplis (on n'a plus à recopier un UUID) ;
//   - suppression en deux temps (Oui / Non) et erreurs affichées ;
//   - filtre par type d'entité, différé de 300 ms.

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IconLanguage, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { Button, Modal, TextArea, TextField } from '@/components/ui';
import { Chip, EmptyState, FormError, FormSection, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { useRemoveTranslation, useTranslationsList, useUpsertTranslation } from '@/hooks/useTranslations';
import { ApiError } from '@/services/api/ApiError';

type TranslationItem = NonNullable<ReturnType<typeof useTranslationsList>['data']>['data'][number];

interface EntityGroup {
  key: string;
  entityType: string;
  entityId: string;
  items: TranslationItem[];
}

interface EntityRef {
  entityType: string;
  entityId: string;
}

// Un générique multi-lignes passé directement à useState<...> commençant par
// une accolade sur une nouvelle ligne fait planter le parseur SWC/Next.js en
// .tsx — d'où cet alias nommé sur une seule ligne.
type ModalState = { prefill?: EntityRef } | null;

function groupByEntity(items: TranslationItem[]): EntityGroup[] {
  const groups = new Map<string, EntityGroup>();
  for (const item of items) {
    const key = `${item.entityType}:${item.entityId}`;
    let group = groups.get(key);
    if (!group) {
      group = { key, entityType: item.entityType, entityId: item.entityId, items: [] };
      groups.set(key, group);
    }
    group.items.push(item);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => a.field.localeCompare(b.field) || a.locale.localeCompare(b.locale)),
    }))
    .sort((a, b) => a.entityType.localeCompare(b.entityType) || a.entityId.localeCompare(b.entityId));
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
}

function TranslationRow({ translation }: { translation: TranslationItem }) {
  const remove = useRemoveTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-text-primary">{translation.field}</span>
          <Chip tone="primary">{translation.locale.toUpperCase()}</Chip>
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-secondary">{translation.value}</p>
        {remove.error ? (
          <p className="mt-1 text-xs text-danger">
            {remove.error instanceof ApiError ? remove.error.message : 'Suppression impossible.'}
          </p>
        ) : null}
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-border/40"
          >
            Non
          </button>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() =>
              remove.mutate(
                {
                  entityType: translation.entityType,
                  entityId: translation.entityId,
                  locale: translation.locale,
                  field: translation.field,
                },
                { onSettled: () => setConfirming(false) },
              )
            }
            className="rounded-lg bg-danger-light px-2.5 py-1.5 text-xs font-semibold text-danger-dark transition hover:opacity-80 disabled:opacity-60"
          >
            {remove.isPending ? '…' : 'Supprimer'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label={`Supprimer la traduction ${translation.field} (${translation.locale})`}
          className="shrink-0 rounded-lg p-2 text-text-muted transition hover:bg-danger-light/40 hover:text-danger"
        >
          <IconTrash size={16} />
        </button>
      )}
    </li>
  );
}

function EntityGroupCard({ group, onAdd }: { group: EntityGroup; onAdd: () => void }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Chip tone="accent">{group.entityType}</Chip>
          <p className="mt-1.5 truncate font-mono text-xs text-text-muted" title={group.entityId}>
            {group.entityId}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <IconPlus size={14} />
          Ajouter
        </button>
      </div>
      <ul className="mt-4 divide-y divide-border">
        {group.items.map((translation) => (
          <TranslationRow key={`${translation.field}-${translation.locale}`} translation={translation} />
        ))}
      </ul>
    </div>
  );
}

function TranslationModal({ open, onClose, prefill }: { open: boolean; onClose: () => void; prefill?: EntityRef }) {
  const upsert = useUpsertTranslation();

  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [locale, setLocale] = useState('en');
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setEntityType(prefill?.entityType ?? '');
    setEntityId(prefill?.entityId ?? '');
    setLocale('en');
    setField('');
    setValue('');
    setErrorMessage(undefined);
  }, [open, prefill]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (!entityType.trim() || !entityId.trim() || !locale.trim() || !field.trim() || !value.trim()) {
      setErrorMessage('Tous les champs sont requis.');
      return;
    }

    try {
      await upsert.mutateAsync({
        entityType: entityType.trim(),
        entityId: entityId.trim(),
        locale: locale.trim(),
        field: field.trim(),
        value: value.trim(),
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ajouter une traduction"
      zIndex={60}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" form="translation-form" loading={upsert.isPending}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="translation-form" onSubmit={handleSubmit} className="space-y-6">
        {prefill ? (
          <div className="rounded-2xl bg-primary-light/50 p-4">
            <p className="text-xs font-semibold text-text-secondary">Enregistrement à traduire</p>
            <div className="mt-1.5">
              <Chip tone="accent">{prefill.entityType}</Chip>
            </div>
            <p className="mt-1.5 break-all font-mono text-xs text-text-muted">{prefill.entityId}</p>
          </div>
        ) : (
          <FormSection title="Enregistrement à traduire" description="Le type de la table et l’identifiant de la ligne concernée.">
            <TextField label="Type d’entité" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="ShipmentCategory" />
            <TextField label="Id de l’enregistrement" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          </FormSection>
        )}

        <FormSection title="Traduction" description="Le champ à traduire, la langue cible et la valeur traduite.">
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Champ" value={field} onChange={(e) => setField(e.target.value)} placeholder="name" />
            <TextField label="Langue" value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="en" />
          </div>
          <TextArea label="Valeur traduite" value={value} onChange={(e) => setValue(e.target.value)} rows={3} />
        </FormSection>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

export default function TranslationsPage() {
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const debouncedFilter = useDebouncedValue(entityTypeFilter.trim(), 300);
  const { data, isLoading, isError } = useTranslationsList({ entityType: debouncedFilter || undefined });

  const [modal, setModal] = useState<ModalState>(null);

  const items = data?.data ?? [];
  const groups = useMemo(() => groupByEntity(items), [items]);
  const localesCount = useMemo(() => new Set(items.map((item) => item.locale)).size, [items]);
  const hasFilter = entityTypeFilter.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Contenu"
        title="Traductions"
        description="Traduit un champ d’un enregistrement dans une langue donnée. Français au lancement, autres langues ensuite."
        stats={[
          { value: data ? String(items.length) : '…', label: items.length > 1 ? 'traductions' : 'traduction' },
          { value: data ? String(groups.length) : '…', label: groups.length > 1 ? 'enregistrements' : 'enregistrement' },
          { value: data ? String(localesCount) : '…', label: localesCount > 1 ? 'langues' : 'langue' },
        ]}
      />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={entityTypeFilter}
            onChange={(e) => setEntityTypeFilter(e.target.value)}
            placeholder="Filtrer par type d’entité…"
            aria-label="Filtrer par type d’entité"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <Button type="button" onClick={() => setModal({})} className="shrink-0">
          <IconPlus size={16} />
          Ajouter
        </Button>
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger les traductions.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={3} heightClass="h-40" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<IconLanguage size={26} />}
          title={hasFilter ? 'Aucune traduction pour ce type' : 'Aucune traduction'}
          text={
            hasFilter
              ? 'Vérifie le type d’entité saisi ou efface le filtre.'
              : 'Ajoute la première traduction : un enregistrement, un champ et la valeur dans la langue cible.'
          }
          action={
            <Button type="button" onClick={() => setModal({})}>
              <IconPlus size={16} />
              Ajouter une traduction
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => (
            <EntityGroupCard
              key={group.key}
              group={group}
              onAdd={() => setModal({ prefill: { entityType: group.entityType, entityId: group.entityId } })}
            />
          ))}
        </div>
      )}

      <TranslationModal open={modal !== null} onClose={() => setModal(null)} prefill={modal?.prefill} />
    </div>
  );
}