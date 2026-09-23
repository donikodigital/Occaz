// web-admin/src/app/(app)/promo-codes/page.tsx
//
// Cartes ombrées, pas de tableau — une par code promo (code, réduction,
// portée, usage, statut), filtre Actifs/Inactifs, recherche.

'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconChevronRight, IconDiscount2, IconPlus, IconSearch } from '@tabler/icons-react';
import { Chip, EmptyState, FilterChips, LinkButton, ListSkeleton, Notice, PageHero, isoToFlagEmoji } from '@/components/admin/AdminUi';
import { describeDiscount } from '@/components/promoCodes/PromoCodeForm';
import { usePromoCodes } from '@/hooks/usePromotions';
import { useCountries } from '@/hooks/useGeography';
import { formatMoney } from '@/utils/money';
import type { PromoCode } from '@/types/promotions.types';
import type { Country } from '@/types/geography.types';

type StatusFilter = 'active' | 'inactive';

function scopeLabel(countryId: string | null, countries: Country[]): string {
  if (!countryId) return 'Tous les pays';
  const country = countries.find((item) => item.id === countryId);
  return country ? `${isoToFlagEmoji(country.isoCode)} ${country.name}` : 'Un pays précis';
}

function PromoCodeCard({ promoCode, countries }: { promoCode: PromoCode; countries: Country[] }) {
  const isExpired = Boolean(promoCode.expiresAt && new Date(promoCode.expiresAt) < new Date());
  return (
    <Link
      href={`/promo-codes/${promoCode.id}`}
      className={`group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
        promoCode.isActive ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-lg font-bold text-primary">
          %
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-sm font-bold tracking-wide text-text-primary">{promoCode.code}</p>
          <p className="truncate text-xs text-text-secondary">{scopeLabel(promoCode.countryId, countries)}</p>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      <p className="text-sm font-semibold text-primary">{describeDiscount(promoCode.discountType, promoCode.discountValue)}</p>

      <div className="mt-auto flex flex-wrap items-center gap-2">
        {!promoCode.isActive ? <Chip tone="danger">Inactif</Chip> : isExpired ? <Chip tone="danger">Expiré</Chip> : <Chip tone="success">Actif</Chip>}
        {promoCode.serviceType ? <Chip tone="neutral">{promoCode.serviceType === 'TRIP' ? 'Trajets' : 'Envois'}</Chip> : null}
        <Chip tone="accent">
          {promoCode.usedCount} utilisation{promoCode.usedCount > 1 ? 's' : ''}
          {promoCode.usageLimit ? ` / ${promoCode.usageLimit}` : ''}
        </Chip>
        {promoCode.minAmount ? <Chip tone="neutral">Dès {formatMoney(promoCode.minAmount)}</Chip> : null}
      </div>
    </Link>
  );
}

export default function PromoCodesPage() {
  const { data: promoCodesPage, isLoading, isError } = usePromoCodes();
  const { data: countries } = useCountries();

  const [status, setStatus] = useState<StatusFilter | ''>('');
  const [search, setSearch] = useState('');

  const all = promoCodesPage?.data ?? [];
  const activeCount = all.filter((p) => p.isActive).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return all.filter((p) => {
      if (status === 'active' && !p.isActive) return false;
      if (status === 'inactive' && p.isActive) return false;
      if (!query) return true;
      return p.code.toLowerCase().includes(query) || (p.description ?? '').toLowerCase().includes(query);
    });
  }, [all, status, search]);

  const hasFilters = status !== '' || search.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Promotions"
        title="Codes promo"
        description="Réductions activables par les clients depuis l'application."
        stats={[
          { value: promoCodesPage ? String(all.length) : '…', label: all.length > 1 ? 'codes' : 'code' },
          { value: promoCodesPage ? String(activeCount) : '…', label: activeCount > 1 ? 'actifs' : 'actif' },
        ]}
      />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un code…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <LinkButton href="/promo-codes/new" icon={<IconPlus size={16} />}>
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
        <Notice tone="danger">Impossible de charger les codes promo.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-40" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconDiscount2 size={26} />}
          title={hasFilters ? 'Aucun code ne correspond' : 'Aucun code promo'}
          text={hasFilters ? 'Essaie une autre recherche ou retire le filtre.' : 'Crée ton premier code promo pour tes clients.'}
          action={<LinkButton href="/promo-codes/new" icon={<IconPlus size={16} />}>Ajouter un code</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((promoCode) => (
            <PromoCodeCard key={promoCode.id} promoCode={promoCode} countries={countries ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}