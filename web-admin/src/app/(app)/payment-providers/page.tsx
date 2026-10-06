// web-admin/src/app/(app)/payment-providers/page.tsx
//
// v2 — Même structure que les autres pages d'administration : bandeau compact
// avec 3 statistiques sur une ligne (total, actifs, à configurer), alerte si
// aucun moyen n'est actif, cartes à barre de couleur (bleue si actif, grise
// sinon) avec l'interrupteur en pied de carte.
'use client';

import React from 'react';
import Link from 'next/link';
import { IconChevronRight, IconCreditCard, IconPlus, IconWorld } from '@tabler/icons-react';
import { usePaymentProviders, useTogglePaymentProviderActive } from '@/hooks/usePaymentProviders';
import { useCountries } from '@/hooks/useGeography';
import { PAYMENT_PROVIDER_TYPE_LABELS } from '@/utils/paymentProviderLabels';
import {
  CardShell,
  EmptyState,
  LinkButton,
  ListSkeleton,
  MetaItem,
  Notice,
  PageHero,
} from '@/components/admin/AdminUi';
import {
  ActiveBadge,
  ConfigChip,
  ProviderIcon,
  ToggleSwitch,
  configKeyCount,
} from '@/components/paymentProviders/paymentUi';
import type { PaymentProvider } from '@/types/paymentProviders.types';

type ProviderCardProps = {
  provider: PaymentProvider;
  countryLabel: string;
};

function ProviderCard({ provider, countryLabel }: ProviderCardProps) {
  const toggle = useTogglePaymentProviderActive(provider.id);
  const typeLabel = PAYMENT_PROVIDER_TYPE_LABELS[provider.type] ?? provider.type;

  return (
    <CardShell tone={provider.isActive ? 'primary' : 'neutral'} className="group flex h-full flex-col">
      <Link
        href={`/payment-providers/${provider.id}`}
        className="block flex-1 p-3.5 pl-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <div className="flex items-center gap-3">
          <div className={`shrink-0 ${provider.isActive ? '' : 'opacity-60 grayscale'}`}>
            <ProviderIcon type={provider.type} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="break-words font-semibold leading-snug text-text-primary transition-colors group-hover:text-primary">
              {provider.name}
            </h2>
            <p className="text-xs text-text-muted">{typeLabel}</p>
          </div>
          <IconChevronRight
            size={18}
            className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5"
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-muted px-2 py-1 text-xs font-semibold text-text-secondary">
            <IconWorld size={13} />
            {countryLabel}
          </span>
          <ConfigChip config={provider.config} />
        </div>
      </Link>

      <div className="flex items-center justify-between gap-3 border-t border-border/70 bg-surface-muted/50 py-2.5 pl-5 pr-3.5">
        <ActiveBadge active={provider.isActive} />
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-text-secondary">
            {provider.isActive ? 'Proposé aux clients' : 'Masqué'}
          </span>
          <ToggleSwitch
            checked={provider.isActive}
            disabled={toggle.isPending}
            onChange={(next) => toggle.mutate(next)}
            label={`${provider.isActive ? 'Désactiver' : 'Activer'} ${provider.name}`}
          />
        </div>
      </div>
    </CardShell>
  );
}

/**
 * Résout le trou opérationnel signalé pendant la livraison mobile
 * (aucun moyen de paiement n'est pré-créé en base — voir
 * backend/README.md, section "Comptes provisionnés") : c'est ici qu'on
 * en crée un pour la première fois sans passer par l'API directement.
 */
export default function PaymentProvidersPage() {
  const { data: providers, isLoading, isError } = usePaymentProviders();
  const { data: countries } = useCountries();
  const countryNameById = new Map((countries ?? []).map((c) => [c.id, c.name]));

  const list = providers ?? [];
  const activeCount = list.filter((provider) => provider.isActive).length;
  const unconfiguredCount = list.filter((provider) => configKeyCount(provider.config) === 0).length;

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Finance"
        title="Moyens de paiement"
        description="Les moyens de paiement proposés aux clients au moment de payer."
        stats={[
          { value: providers ? String(list.length) : '…', label: list.length > 1 ? 'moyens' : 'moyen' },
          { value: providers ? String(activeCount) : '…', label: activeCount > 1 ? 'actifs' : 'actif' },
          { value: providers ? String(unconfiguredCount) : '…', label: 'à configurer' },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-xs text-text-secondary sm:text-sm">
          Un client ne peut payer que si au moins un moyen actif existe ici.
        </p>
        <LinkButton href="/payment-providers/new" icon={<IconPlus size={16} />}>
          Ajouter
        </LinkButton>
      </div>

      {providers && activeCount === 0 && list.length > 0 ? (
        <Notice>Aucun moyen actif : les clients ne peuvent actuellement pas payer.</Notice>
      ) : null}

      {isError ? (
        <Notice tone="danger">Impossible de charger les moyens de paiement.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={3} heightClass="h-36" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : list.length === 0 ? (
        <EmptyState
          icon={<IconCreditCard size={26} />}
          title="Aucun moyen de paiement"
          text="Aucun moyen de paiement configuré : les paiements sont actuellement impossibles sur la plateforme."
          action={
            <LinkButton href="/payment-providers/new" icon={<IconPlus size={16} />}>
              Ajouter le premier moyen de paiement
            </LinkButton>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              countryLabel={
                provider.countryId ? (countryNameById.get(provider.countryId) ?? 'Pays spécifique') : 'Tous pays'
              }
            />
          ))}

          <Link
            href="/payment-providers/new"
            className="group flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border-strong bg-surface/50 p-4 text-center text-sm font-semibold text-text-secondary transition hover:-translate-y-0.5 hover:border-primary/60 hover:bg-surface hover:text-primary hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-surface-muted text-text-muted transition-colors group-hover:bg-primary-light group-hover:text-primary">
              <IconPlus size={20} />
            </span>
            Ajouter un moyen de paiement
          </Link>
        </div>
      )}
    </div>
  );
}
