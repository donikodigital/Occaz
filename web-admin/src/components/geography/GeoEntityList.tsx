// web-admin/src/components/geography/GeoEntityList.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { IconPencil, IconPlus, IconSearch } from '@tabler/icons-react';
import { Button } from '@/components/ui';

export interface GeoEntityListItem {
  id: string;
  name: string;
}

export interface GeoEntityListProps {
  title: string;
  items: GeoEntityListItem[];
  isLoading?: boolean;
  emptyLabel: string;
  searchPlaceholder: string;
  onAdd: () => void;
  onEdit: (item: GeoEntityListItem) => void;
  selectedId?: string;
  onSelect?: (item: GeoEntityListItem) => void;
  disabled?: boolean;
  disabledHint?: string;
  helperText?: string;
  /** Masque le titre + bouton "Ajouter" internes — utilisé quand le composant est déjà encapsulé dans un Disclosure qui porte son propre titre/bouton (voir LocationsPanel). */
  hideHeader?: boolean;
}

/**
 * Liste compacte, scrollable et cherchable — remplace les chips qui
 * s'enroulaient mal dès qu'il y avait beaucoup d'entrées (ex. 20 régions).
 * Clic sur la ligne = sélection ; icône crayon = ouvre le modal
 * renommer/supprimer.
 */
export function GeoEntityList({
  title,
  items,
  isLoading,
  emptyLabel,
  searchPlaceholder,
  onAdd,
  onEdit,
  selectedId,
  onSelect,
  disabled,
  disabledHint,
  helperText,
  hideHeader = false,
}: GeoEntityListProps) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.name.toLowerCase().includes(query));
  }, [items, search]);

  return (
    <div className={hideHeader ? '' : 'rounded-xl border border-border bg-surface-muted/30 p-4'}>
      {!hideHeader ? (
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-text-secondary">{title}</h3>
          <Button type="button" variant="secondary" className="px-2.5 py-1.5 text-xs" onClick={onAdd} disabled={disabled}>
            <IconPlus size={14} />
            Ajouter
          </Button>
        </div>
      ) : null}

      {disabled ? (
        <p className="text-sm text-text-muted">{disabledHint}</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-text-muted">{emptyLabel}</p>
      ) : (
        <>
          {items.length > 6 ? (
            <div className="relative mb-2">
              <IconSearch size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          ) : null}
          <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-text-muted">Aucun résultat.</p>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <div
                      key={item.id}
                      role={onSelect ? 'button' : undefined}
                      tabIndex={onSelect ? 0 : undefined}
                      onClick={() => onSelect?.(item)}
                      className={`flex items-center justify-between gap-2 px-3 py-2 text-sm transition-colors ${
                        onSelect ? 'cursor-pointer' : ''
                      } ${isSelected ? 'bg-primary-light/50 text-primary-dark' : 'text-text-primary hover:bg-surface-muted/60'}`}
                    >
                      <span className="truncate">{item.name}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEdit(item);
                        }}
                        className="shrink-0 rounded-md p-1 text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
                        aria-label={`Modifier ${item.name}`}
                      >
                        <IconPencil size={14} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
      {helperText && !disabled && items.length > 0 ? <p className="mt-2 text-xs text-text-muted">{helperText}</p> : null}
    </div>
  );
}