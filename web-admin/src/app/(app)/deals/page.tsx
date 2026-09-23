// web-admin/src/app/(app)/deals/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconChevronRight, IconPlus, IconSearch, IconTicket } from '@tabler/icons-react';
import { Chip, EmptyState, FilterChips, LinkButton, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { useDeals } from '@/hooks/usePromotions';
import type { Deal } from '@/types/promotions.types';

type StatusFilter = 'active' | 'inactive';

function DealCard({ deal }: { deal: Deal }) {
  const isExpired = Boolean(deal.expiresAt && new Date(deal.expiresAt) < new Date());
  return (
    <Link
      href={`/deals/${deal.id}`}
      className={`group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
        deal.isActive ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        {deal.imageUrl ? (
          <img src={deal.imageUrl} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-light text-xl">🎟️</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{deal.title}</p>
          <p className="line-clamp-2 text-xs text-text-secondary">{deal.description}</p>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {!deal.isActive ? <Chip tone="danger">Inactif</Chip> : isExpired ? <Chip tone="danger">Expiré</Chip> : <Chip tone="success">Actif</Chip>}
      </div>
    </Link>
  );
}

export default function DealsPage() {
  const { data: dealsPage, isLoading, isError } = useDeals();
  const [status, setStatus] = useState<StatusFilter | ''>('');
  const [search, setSearch] = useState('');

  const all = dealsPage?.data ?? [];
  const activeCount = all.filter((d) => d.isActive).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...all]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((d) => {
        if (status === 'active' && !d.isActive) return false;
        if (status === 'inactive' && d.isActive) return false;
        if (!query) return true;
        return d.title.toLowerCase().includes(query) || d.description.toLowerCase().includes(query);
      });
  }, [all, status, search]);

  const hasFilters = status !== '' || search.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Promotions"
        title="Bons plans"
        description="Contenu mis en avant pour les clients dans l'application."
        stats={[
          { value: dealsPage ? String(all.length) : '…', label: all.length > 1 ? 'bons plans' : 'bon plan' },
          { value: dealsPage ? String(activeCount) : '…', label: activeCount > 1 ? 'actifs' : 'actif' },
        ]}
      />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un bon plan…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <LinkButton href="/deals/new" icon={<IconPlus size={16} />}>
          Ajouter
        </LinkButton>
      </div>

      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: 'active', label: 'Actifs' },
          { value: 'inactive', label: 'Inactifs' },
        ]}
        allLabel="Tous"
      />

      {isError ? (
        <Notice tone="danger">Impossible de charger les bons plans.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-36" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconTicket size={26} />}
          title={hasFilters ? 'Aucun bon plan ne correspond' : 'Aucun bon plan'}
          text={hasFilters ? 'Essaie une autre recherche ou retire le filtre.' : 'Ajoute une offre à mettre en avant côté client.'}
          action={<LinkButton href="/deals/new" icon={<IconPlus size={16} />}>Ajouter un bon plan</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}