// web-admin/src/app/(app)/referrals/page.tsx
//
// Parrainages : une carte par parrainage (parrain → filleul), avec un
// bouton pour valider et créditer la récompense. La détection automatique
// à la première prestation payée du filleul n'est pas encore branchée
// (voir ReferralsService, backend) — c'est pour l'instant ici que ça se
// décide, à la main.

'use client';

import React, { useMemo, useState } from 'react';
import { IconArrowRight, IconGift, IconSearch } from '@tabler/icons-react';
import { Button, TextField } from '@/components/ui';
import { Chip, EmptyState, FilterChips, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { useCompleteReferral, useReferrals } from '@/hooks/usePromotions';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import type { AdminReferral, ReferralStatus } from '@/types/promotions.types';

const STATUS_LABELS: Record<ReferralStatus, string> = { PENDING: 'En attente', COMPLETED: 'Validé', EXPIRED: 'Expiré' };
const STATUS_TONES: Record<ReferralStatus, 'accent' | 'success' | 'neutral'> = { PENDING: 'accent', COMPLETED: 'success', EXPIRED: 'neutral' };

function nameOf(person: AdminReferral['referrer']): string {
  const profile = person.driverProfile ?? person.customerProfile;
  return profile ? `${profile.firstName} ${profile.lastName}` : (person.phone ?? 'Utilisateur');
}

function ReferralCard({ referral }: { referral: AdminReferral }) {
  const completeReferral = useCompleteReferral();
  const [rewardAmount, setRewardAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  function handleComplete() {
    setErrorMessage(undefined);
    if (!rewardAmount.trim()) {
      setErrorMessage('Indique le montant de la récompense.');
      return;
    }
    completeReferral.mutate(
      { id: referral.id, rewardAmount: rewardAmount.replace(/\D/g, '') },
      { onError: (error) => setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.') },
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md">
      <div className="flex items-center gap-2 text-sm">
        <span className="min-w-0 truncate font-semibold text-text-primary">{nameOf(referral.referrer)}</span>
        <IconArrowRight size={14} className="shrink-0 text-text-muted" />
        <span className="min-w-0 truncate text-text-secondary">{nameOf(referral.referee)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={STATUS_TONES[referral.status]}>{STATUS_LABELS[referral.status]}</Chip>
        <span className="text-xs text-text-muted">Inscrit le {new Date(referral.createdAt).toLocaleDateString('fr-FR')}</span>
      </div>

      {referral.status === 'COMPLETED' ? (
        <p className="text-sm font-semibold text-success-dark">Récompense : {referral.rewardAmount ? formatMoney(referral.rewardAmount) : '—'}</p>
      ) : (
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <TextField label="Montant de la récompense" value={rewardAmount} onChange={(e) => setRewardAmount(e.target.value)} placeholder="Ex : 20000" />
          </div>
          <Button type="button" onClick={handleComplete} loading={completeReferral.isPending}>
            Valider
          </Button>
        </div>
      )}
      {errorMessage ? <p className="text-xs text-danger">{errorMessage}</p> : null}
    </div>
  );
}

export default function ReferralsPage() {
  const { data: referralsPage, isLoading, isError } = useReferrals();
  const [status, setStatus] = useState<ReferralStatus | ''>('');
  const [search, setSearch] = useState('');

  const all = referralsPage?.data ?? [];
  const pendingCount = all.filter((r) => r.status === 'PENDING').length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return all.filter((r) => {
      if (status && r.status !== status) return false;
      if (!query) return true;
      return nameOf(r.referrer).toLowerCase().includes(query) || nameOf(r.referee).toLowerCase().includes(query);
    });
  }, [all, status, search]);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Promotions"
        title="Parrainage"
        description="Parrainages en cours, à valider manuellement pour créditer la récompense."
        stats={[
          { value: referralsPage ? String(all.length) : '…', label: all.length > 1 ? 'parrainages' : 'parrainage' },
          { value: referralsPage ? String(pendingCount) : '…', label: 'en attente' },
        ]}
      />

      <div className="relative">
        <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un parrain ou un filleul…"
          className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: 'PENDING', label: 'En attente' },
          { value: 'COMPLETED', label: 'Validés' },
          { value: 'EXPIRED', label: 'Expirés' },
        ]}
        allLabel="Tous"
      />

      {isError ? (
        <Notice tone="danger">Impossible de charger les parrainages.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-32" />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<IconGift size={26} />} title="Aucun parrainage" text="Les parrainages des clients apparaîtront ici." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((referral) => (
            <ReferralCard key={referral.id} referral={referral} />
          ))}
        </div>
      )}
    </div>
  );
}