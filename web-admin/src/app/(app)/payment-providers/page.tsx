// web-admin/src/app/(app)/payment-providers/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCreditCard,
  IconInfoCircle,
  IconPlus,
  IconWorld,
} from '@tabler/icons-react';
import { usePaymentProviders, useTogglePaymentProviderActive } from '@/hooks/usePaymentProviders';
import { useCountries } from '@/hooks/useGeography';
import { PAYMENT_PROVIDER_TYPE_LABELS } from '@/utils/paymentProviderLabels';
import { DisputeMotionStyles, Skeleton, disputeFont } from '@/components/disputes/disputeUi';
import {
  ActiveBadge,
  ConfigChip,
  LinkButton,
  ProviderIcon,
  SummaryTile,
  ToggleSwitch,
  configKeyCount,
} from '@/components/paymentProviders/paymentUi';
import type { PaymentProvider } from '@/types/paymentProviders.types';

type ProviderCardProps = {
  provider: PaymentProvider;
  countryLabel: string;
  index: number;
};

function ProviderCard({ provider, countryLabel, index }: ProviderCardProps) {
  const toggle = useTogglePaymentProviderActive(provider.id);
  const typeLabel = PAYMENT_PROVIDER_TYPE_LABELS[provider.type] ?? provider.type;

  return (
    <div className="dispute-fade-up h-full" style={{ animationDelay: `${Math.min(index, 10) * 70 + 120}ms` }}>
      <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/20">
        <span
          className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${
            provider.isActive ? 'from-[#0b62a3] to-[#083a63]' : 'from-slate-300 to-slate-400'
          }`}
        />

        <Link
          href={`/payment-providers/${provider.id}`}
          className="block flex-1 p-4 pl-6 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
        >
          <div className="flex items-start gap-3">
            <div className={`shrink-0 ${provider.isActive ? '' : 'opacity-60 grayscale'}`}>
              <ProviderIcon type={provider.type} />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="break-words text-base font-bold leading-snug text-slate-900 transition-colors group-hover:text-indigo-700">
                {provider.name}
              </h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">{typeLabel}</p>
            </div>
            <IconChevronRight
              size={20}
              className="mt-1 shrink-0 text-slate-300 transition-all duration-300 group-hover:translate-x-1 group-hover:text-indigo-500"
            />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
              <IconWorld size={13} />
              {countryLabel}
            </span>
            <ConfigChip config={provider.config} />
          </div>
        </Link>

        <div className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 py-3 pl-6 pr-4">
          <ActiveBadge active={provider.isActive} />
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-semibold text-slate-500">
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
      </div>
    </div>
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
    <div className={`${disputeFont.className} space-y-6`}>
      <DisputeMotionStyles />

      <header className="dispute-fade-up flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
            <IconCreditCard size={24} />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Moyens de paiement</h1>
            <p className="text-sm font-medium text-slate-500">
              {providers
                ? `${list.length} moyen${list.length > 1 ? 's' : ''} · ${activeCount} actif${activeCount > 1 ? 's' : ''}`
                : '\u00A0'}
            </p>
          </div>
        </div>
        <LinkButton href="/payment-providers/new" icon={<IconPlus size={16} />} className="w-full sm:w-auto">
          Ajouter un moyen de paiement
        </LinkButton>
      </header>

      {isError ? (
        <div className="rounded-2xl bg-rose-50 p-5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
          Impossible de charger les moyens de paiement.
        </div>
      ) : isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="hidden h-40 sm:block" />
        </div>
      ) : list.length === 0 ? (
        <div className="dispute-pop flex flex-col items-center rounded-2xl border-2 border-dashed border-slate-200 bg-white/60 px-6 py-12 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-500">
            <IconCreditCard size={28} />
          </span>
          <p className="mt-4 text-base font-bold text-slate-900">Aucun moyen de paiement</p>
          <p className="mt-1 max-w-sm text-sm text-slate-500">
            Aucun moyen de paiement configuré : les paiements sont actuellement impossibles sur la plateforme.
          </p>
          <LinkButton href="/payment-providers/new" icon={<IconPlus size={16} />} className="mt-5">
            Ajouter le premier moyen de paiement
          </LinkButton>
        </div>
      ) : (
        <>
          <div className="dispute-fade-up grid grid-cols-3 gap-3" style={{ animationDelay: '60ms' }}>
            <SummaryTile label="Total" value={list.length} tone="indigo" />
            <SummaryTile label="Actifs" value={activeCount} tone="blue" />
            <SummaryTile label="À configurer" value={unconfiguredCount} tone="amber" />
          </div>

          {activeCount === 0 ? (
            <div
              className="dispute-fade-up flex items-start gap-3 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-800 ring-1 ring-inset ring-amber-200"
              style={{ animationDelay: '100ms' }}
            >
              <IconAlertTriangle size={20} className="mt-0.5 shrink-0" />
              Aucun moyen actif : les clients ne peuvent actuellement pas payer.
            </div>
          ) : (
            <div
              className="dispute-fade-up flex items-start gap-3 rounded-2xl bg-white/70 p-4 text-sm font-medium text-slate-600 ring-1 ring-inset ring-slate-200"
              style={{ animationDelay: '100ms' }}
            >
              <IconInfoCircle size={20} className="mt-0.5 shrink-0 text-indigo-500" />
              Un client ne peut payer que si au moins un moyen actif existe ici.
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((provider, index) => (
              <ProviderCard
                key={provider.id}
                provider={provider}
                index={index}
                countryLabel={
                  provider.countryId
                    ? (countryNameById.get(provider.countryId) ?? 'Pays spécifique')
                    : 'Tous pays'
                }
              />
            ))}

            <div
              className="dispute-fade-up h-full"
              style={{ animationDelay: `${Math.min(list.length, 10) * 70 + 120}ms` }}
            >
              <Link
                href="/payment-providers/new"
                className="group flex h-full min-h-[9rem] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/50 p-4 text-center text-sm font-bold text-slate-500 transition-all duration-300 hover:-translate-y-1 hover:border-indigo-400 hover:bg-white hover:text-indigo-600 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              >
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-500">
                  <IconPlus size={22} />
                </span>
                Ajouter un moyen de paiement
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}