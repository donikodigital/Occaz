// web-admin/src/components/roles/RoleForm.tsx
//
// Formulaire commun aux pages « Créer un rôle » et « Modifier un rôle », et
// petites aides d'affichage partagées avec la liste des rôles.
//   - Les permissions sont regroupées par domaine (« trip.read » → domaine
//     « trip »). Chaque domaine est une carte repliable avec sa jauge
//     (« 3 sur 6 ») et un bouton « Tout » ; chaque permission a son
//     interrupteur, sa clé technique et sa description quand elle existe ;
//   - une recherche filtre toutes les permissions et déplie les domaines
//     qui correspondent ;
//   - un résumé (« 12 sur 37 ») avec « Tout sélectionner / Tout retirer » ;
//   - en modification : la clé est figée, et un repère « non enregistré »
//     apparaît dès qu'on change quelque chose.
// Les libellés de domaines et d'actions ne sont qu'une traduction d'affichage
// des clés du catalogue : une clé inconnue s'affiche avec son nom brut.

'use client';

import React, { useMemo, useState } from 'react';
import { IconChevronDown, IconSearch, IconShieldCheck } from '@tabler/icons-react';
import { Button, TextField } from '@/components/ui';
import { Chip, FormError, Notice, SavedNotice, SectionCard } from '@/components/admin/AdminUi';
import { usePermissionsCatalog } from '@/hooks/useRbac';

export type PermissionItem = NonNullable<ReturnType<typeof usePermissionsCatalog>['data']>[number];

// ---------------------------------------------------------------------------
// Aides d'affichage (aussi utilisées par la liste des rôles)
// ---------------------------------------------------------------------------

const DOMAIN_LABELS: Record<string, string> = {
  user: 'Utilisateurs',
  trip: 'Trajets',
  shipment: 'Envois',
  dispute: 'Litiges',
  refund: 'Remboursements',
  driver: 'Chauffeurs',
  geography: 'Géographie',
  audit: 'Journal d’audit',
  settings: 'Paramètres',
};

const ACTION_LABELS: Record<string, string> = {
  read: 'Consulter',
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
  manage: 'Gérer',
  suspend: 'Suspendre',
  resolve: 'Résoudre',
  verify: 'Vérifier',
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function domainOf(permissionKey: string): string {
  return permissionKey.split('.')[0] ?? 'autre';
}

export function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? capitalize(domain.replace(/[._-]+/g, ' '));
}

export function actionLabel(permissionKey: string): string {
  const [, ...rest] = permissionKey.split('.');
  const action = rest.join('.') || permissionKey;
  return ACTION_LABELS[action] ?? capitalize(action.replace(/[._-]+/g, ' '));
}

/** Description de la permission si le catalogue en fournit une. */
export function permissionDescription(permission: object): string | null {
  const value = (permission as { description?: unknown }).description;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Clés des permissions d'un rôle, lues sans supposer la forme exacte des liens renvoyés par l'API. */
export function permissionKeysOf(role: object): string[] {
  const links = (role as { permissions?: unknown }).permissions;
  if (!Array.isArray(links)) return [];
  return links
    .map((link) => (link as { permission?: { key?: unknown } }).permission?.key)
    .filter((key): key is string => typeof key === 'string');
}

export function MeterBar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-primary-light">
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaire
// ---------------------------------------------------------------------------

export interface RoleFormValues {
  key: string;
  name: string;
  description?: string;
  permissionKeys: string[];
}

interface RoleFormProps {
  mode: 'create' | 'edit';
  permissions: PermissionItem[];
  initial?: { key: string; name: string; description?: string | null; permissionKeys: string[] };
  isSubmitting: boolean;
  errorMessage?: string;
  saved?: boolean;
  onSubmit: (values: RoleFormValues) => Promise<void> | void;
}

function PermissionRow({
  permission,
  checked,
  onToggle,
}: {
  permission: PermissionItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const description = permissionDescription(permission);
  return (
    <li>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-primary-light/30"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium text-text-primary">{actionLabel(permission.key)}</span>
          {description ? <span className="mt-0.5 block text-xs text-text-secondary">{description}</span> : null}
          <span className="mt-0.5 block break-all font-mono text-[11px] text-text-muted">{permission.key}</span>
        </span>
        <span
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            checked ? 'bg-primary' : 'bg-border'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-[#ffffff] shadow transition-transform ${
              checked ? 'translate-x-[22px]' : 'translate-x-0.5'
            }`}
          />
        </span>
      </button>
    </li>
  );
}

export function RoleForm({ mode, permissions, initial, isSubmitting, errorMessage, saved, onSubmit }: RoleFormProps) {
  const [key, setKey] = useState(initial?.key ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initial?.permissionKeys ?? []));
  const [query, setQuery] = useState('');
  const [openDomains, setOpenDomains] = useState<Set<string>>(new Set());
  const [validationError, setValidationError] = useState<string | undefined>();

  const groups = useMemo(() => {
    const byDomain = new Map<string, PermissionItem[]>();
    for (const permission of permissions) {
      const domain = domainOf(permission.key);
      byDomain.set(domain, [...(byDomain.get(domain) ?? []), permission]);
    }
    return [...byDomain.entries()]
      .map(([domain, items]) => ({ domain, items: [...items].sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => domainLabel(a.domain).localeCompare(domainLabel(b.domain)));
  }, [permissions]);

  const normalizedQuery = query.trim().toLowerCase();
  const visibleGroups = useMemo(() => {
    if (!normalizedQuery) return groups;
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((permission) => {
          const haystack = [permission.key, actionLabel(permission.key), domainLabel(group.domain), permissionDescription(permission) ?? '']
            .join(' ')
            .toLowerCase();
          return haystack.includes(normalizedQuery);
        }),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, normalizedQuery]);

  const total = permissions.length;
  const initialKeysSignature = useMemo(() => [...(initial?.permissionKeys ?? [])].sort().join('|'), [initial]);
  const isDirty =
    mode === 'edit' &&
    (name.trim() !== (initial?.name ?? '') ||
      description.trim() !== (initial?.description ?? '') ||
      [...selected].sort().join('|') !== initialKeysSignature);

  const isSuperAdminRole = mode === 'edit' && initial?.key === 'superadmin';

  function togglePermission(permissionKey: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(permissionKey)) next.delete(permissionKey);
      else next.add(permissionKey);
      return next;
    });
  }

  function toggleDomain(items: PermissionItem[]) {
    setSelected((previous) => {
      const next = new Set(previous);
      const allSelected = items.every((permission) => next.has(permission.key));
      for (const permission of items) {
        if (allSelected) next.delete(permission.key);
        else next.add(permission.key);
      }
      return next;
    });
  }

  function toggleOpen(domain: string) {
    setOpenDomains((previous) => {
      const next = new Set(previous);
      if (next.has(domain)) next.delete(domain);
      else next.add(domain);
      return next;
    });
  }

  const allOpen = groups.length > 0 && groups.every((group) => openDomains.has(group.domain));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(undefined);

    if (mode === 'create' && !/^[a-z0-9_]+$/.test(key)) {
      setValidationError('La clé doit être en snake_case minuscule (ex : support_supervisor).');
      return;
    }
    if (name.trim().length < 2) {
      setValidationError('Renseignez un nom.');
      return;
    }

    await onSubmit({
      key,
      name: name.trim(),
      description: description.trim() || undefined,
      permissionKeys: Array.from(selected),
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-primary-light/40 p-4 shadow-md">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-primary shadow-sm">
          <IconShieldCheck size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-text-primary">{name.trim() || 'Nouveau rôle'}</p>
          <p className="truncate font-mono text-xs text-text-muted">{key || 'cle_du_role'}</p>
        </div>
        <Chip tone="primary">
          {selected.size} / {total}
        </Chip>
      </div>

      {isSuperAdminRole ? (
        <Notice>
          Rôle SuperAdmin : retirer des permissions peut vous bloquer l’accès à certaines sections de ce back-office.
        </Notice>
      ) : null}

      <SectionCard title="Identité">
        {mode === 'create' ? (
          <TextField
            label="Clé (snake_case)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="support_agent"
            hint="Identifiant technique, en minuscules avec des tirets bas. Il ne change plus ensuite."
            required
          />
        ) : (
          <div className="rounded-2xl bg-primary-light/50 p-4">
            <p className="text-xs font-semibold text-text-secondary">Clé (elle identifie le rôle, elle ne change pas)</p>
            <p className="mt-1 break-all font-mono text-sm text-text-primary">{key}</p>
          </div>
        )}
        <TextField label="Nom affiché" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent clientèle" required />
        <TextField
          label="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Ce que fait ce rôle"
        />
      </SectionCard>

      <SectionCard title="Permissions" description="Ce que ce rôle a le droit de faire. Ouvre un domaine pour voir le détail.">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm text-text-secondary">
              <span className="text-xl font-bold text-text-primary">{selected.size}</span> sur {total} sélectionnées
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setSelected(new Set(permissions.map((permission) => permission.key)))}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light/60"
              >
                Tout sélectionner
              </button>
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-text-secondary transition hover:bg-border/40"
              >
                Tout retirer
              </button>
            </div>
          </div>
          <MeterBar value={selected.size} max={total} />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une permission…"
              aria-label="Rechercher une permission"
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {!normalizedQuery && groups.length > 1 ? (
            <button
              type="button"
              onClick={() => setOpenDomains(allOpen ? new Set() : new Set(groups.map((group) => group.domain)))}
              className="shrink-0 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-text-secondary shadow-sm transition hover:border-primary/40"
            >
              {allOpen ? 'Tout replier' : 'Tout déplier'}
            </button>
          ) : null}
        </div>

        {total === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">Aucune permission dans le catalogue.</p>
        ) : visibleGroups.length === 0 ? (
          <p className="py-6 text-center text-sm text-text-muted">Aucune permission ne correspond à « {query.trim()} ».</p>
        ) : (
          <div className="space-y-3">
            {visibleGroups.map((group) => {
              const allInGroup = permissions.filter((permission) => domainOf(permission.key) === group.domain);
              const selectedCount = allInGroup.filter((permission) => selected.has(permission.key)).length;
              const isOpen = normalizedQuery ? true : openDomains.has(group.domain);
              const allSelected = allInGroup.length > 0 && selectedCount === allInGroup.length;

              return (
                <div key={group.domain} className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
                  <div className="flex items-center gap-2 p-3">
                    <button
                      type="button"
                      onClick={() => toggleOpen(group.domain)}
                      aria-expanded={isOpen}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-sm font-bold text-primary">
                        {domainLabel(group.domain).slice(0, 2).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1 space-y-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-text-primary">{domainLabel(group.domain)}</span>
                          <span className="shrink-0 text-xs font-medium text-text-secondary">
                            {selectedCount} sur {allInGroup.length}
                          </span>
                        </span>
                        <span className="block">
                          <MeterBar value={selectedCount} max={allInGroup.length} />
                        </span>
                      </span>
                      <IconChevronDown size={18} className={`shrink-0 text-text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleDomain(allInGroup)}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary-light/60"
                    >
                      {allSelected ? 'Retirer' : 'Tout'}
                    </button>
                  </div>
                  {isOpen ? (
                    <ul className="divide-y divide-border border-t border-border">
                      {group.items.map((permission) => (
                        <PermissionRow
                          key={permission.key}
                          permission={permission}
                          checked={selected.has(permission.key)}
                          onToggle={() => togglePermission(permission.key)}
                        />
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      <FormError message={validationError ?? errorMessage} />
      {saved && mode === 'edit' && !isDirty ? <SavedNotice>Modifications enregistrées.</SavedNotice> : null}

      <div className="flex items-center justify-between gap-3">
        {isDirty ? <Chip tone="accent">Modifications non enregistrées</Chip> : <span />}
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Créer le rôle' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  );
}