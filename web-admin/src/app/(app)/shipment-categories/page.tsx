// web-admin/src/app/(app)/shipment-categories/page.tsx
//
// v2 — Refonte complète : plus de tableau. Une carte ombrée par catégorie
// (nom, description, majoration en clair, portée avec drapeau, statut),
// filtre Autorisées / Interdites, recherche, états vides et chargement.

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconChevronRight, IconPackage, IconPackageOff, IconPlus, IconSearch } from '@tabler/icons-react';
import { Chip, EmptyState, FilterChips, LinkButton, ListSkeleton, Notice, PageHero, isoToFlagEmoji } from '@/components/admin/AdminUi';
import { describeMultiplier } from '@/components/shipmentCategories/ShipmentCategoryForm';
import { useShipmentCategories } from '@/hooks/useShipmentCategories';
import { useCountries } from '@/hooks/useGeography';
import type { Country } from '@/types/geography.types';

type CategoryItem = NonNullable<ReturnType<typeof useShipmentCategories>['data']>[number];
type StatusFilter = 'allowed' | 'forbidden';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'allowed', label: 'Autorisées' },
  { value: 'forbidden', label: 'Interdites' },
];

function scopeLabel(countryId: string | null | undefined, countries: Country[]): string {
  if (!countryId) return 'Tous les pays';
  const country = countries.find((item) => item.id === countryId);
  return country ? `${isoToFlagEmoji(country.isoCode)} ${country.name}` : 'Un pays précis';
}

function CategoryCard({ category, countries }: { category: CategoryItem; countries: Country[] }) {
  return (
    <Link
      href={`/shipment-categories/${category.id}`}
      className={`group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
        category.isAllowed ? '' : 'opacity-80'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
            category.isAllowed ? 'bg-primary-light text-primary' : 'bg-danger-light text-danger-dark'
          }`}
        >
          {category.isAllowed ? <IconPackage size={22} /> : <IconPackageOff size={22} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{category.name}</p>
          <p className="truncate text-xs text-text-secondary">{scopeLabel(category.countryId, countries)}</p>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      {category.description ? <p className="text-sm text-text-secondary">{category.description}</p> : null}

      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Chip tone={category.isAllowed ? 'success' : 'danger'}>{category.isAllowed ? 'Autorisée' : 'Interdite'}</Chip>
        <Chip tone="accent">×{category.priceMultiplier}</Chip>
        <span className="text-xs text-text-muted">{describeMultiplier(Number(category.priceMultiplier))}</span>
      </div>
    </Link>
  );
}

export default function ShipmentCategoriesPage() {
  const { data: categories, isLoading, isError } = useShipmentCategories();
  const { data: countries } = useCountries();

  const [status, setStatus] = useState<StatusFilter | ''>('');
  const [search, setSearch] = useState('');

  const all = categories ?? [];
  const allowedCount = all.filter((category) => category.isAllowed).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...all]
      .filter((category) => {
        if (status === 'allowed' && !category.isAllowed) return false;
        if (status === 'forbidden' && category.isAllowed) return false;
        if (!query) return true;
        return category.name.toLowerCase().includes(query) || (category.description ?? '').toLowerCase().includes(query);
      })
      .sort((a, b) => Number(b.isAllowed) - Number(a.isAllowed) || a.name.localeCompare(b.name));
  }, [all, status, search]);

  const hasFilters = status !== '' || search.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Envois"
        title="Catégories d’envoi"
        description="Types de colis autorisés et leur majoration de tarif."
        stats={[
          { value: categories ? String(all.length) : '…', label: all.length > 1 ? 'catégories' : 'catégorie' },
          { value: categories ? String(allowedCount) : '…', label: allowedCount > 1 ? 'autorisées' : 'autorisée' },
        ]}
      />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une catégorie…"
            aria-label="Rechercher une catégorie"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <LinkButton href="/shipment-categories/new" icon={<IconPlus size={16} />}>
          Ajouter
        </LinkButton>
      </div>

      <FilterChips value={status} onChange={setStatus} options={STATUS_OPTIONS} allLabel="Toutes" />

      {isError ? (
        <Notice tone="danger">Impossible de charger les catégories.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-36" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconPackage size={26} />}
          title={hasFilters ? 'Aucune catégorie ne correspond' : 'Aucune catégorie d’envoi'}
          text={
            hasFilters
              ? 'Essaie une autre recherche ou retire le filtre.'
              : 'Ajoute les types de colis que les clients peuvent envoyer (documents, colis, etc.).'
          }
          action={<LinkButton href="/shipment-categories/new" icon={<IconPlus size={16} />}>Ajouter une catégorie</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((category) => (
            <CategoryCard key={category.id} category={category} countries={countries ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}