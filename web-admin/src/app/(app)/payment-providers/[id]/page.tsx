// web-admin/src/app/(app)/payment-providers/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { IconInfoCircle, IconSettings, IconToggleRight, IconWallet, IconWorld } from '@tabler/icons-react';
import {
  usePaymentProvider,
  useTogglePaymentProviderActive,
  useUpdatePaymentProvider,
} from '@/hooks/usePaymentProviders';
import { useCountries } from '@/hooks/useGeography';
import { PAYMENT_PROVIDER_TYPE_LABELS } from '@/utils/paymentProviderLabels';
import { ApiError } from '@/services/api/ApiError';
import {
  ActionButton,
  DisputeMotionStyles,
  InputField,
  Panel,
  SelectField,
  Skeleton,
  TextAreaField,
  disputeFont,
} from '@/components/disputes/disputeUi';
import {
  ActiveBadge,
  BackLink,
  LinkButton,
  ProviderIcon,
  SecurityNote,
  ToggleSwitch,
  TypePicker,
  configKeyCount,
} from '@/components/paymentProviders/paymentUi';
import type { PaymentProviderType } from '@/types/paymentProviders.types';

const PROVIDER_TYPES = Object.keys(PAYMENT_PROVIDER_TYPE_LABELS) as PaymentProviderType[];
const TYPE_OPTIONS = PROVIDER_TYPES.map((value) => ({ value, label: PAYMENT_PROVIDER_TYPE_LABELS[value] }));

export default function EditPaymentProviderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: provider, isLoading, isError } = usePaymentProvider(id);
  const { data: countries } = useCountries();
  const updateProvider = useUpdatePaymentProvider(id);
  const toggleActive = useTogglePaymentProviderActive(id);

  const [type, setType] = useState<PaymentProviderType>('ORANGE_MONEY');
  const [name, setName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [configText, setConfigText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!provider) return;
    setType(provider.type);
    setName(provider.name);
    setCountryId(provider.countryId ?? '');
    setConfigText(provider.config ? JSON.stringify(provider.config, null, 2) : '');
  }, [provider]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (name.trim().length < 2) {
      setErrorMessage('Renseignez un nom.');
      return;
    }

    let config: Record<string, unknown> | undefined;
    if (configText.trim()) {
      try {
        config = JSON.parse(configText);
      } catch {
        setErrorMessage('La configuration doit être un JSON valide.');
        return;
      }
    }

    try {
      await updateProvider.mutateAsync({ type, name: name.trim(), countryId: countryId || undefined, config });
      router.push('/payment-providers');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) {
    return (
      <div className={`${disputeFont.className} max-w-2xl space-y-4`}>
        <div className="rounded-2xl bg-rose-50 p-5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
          Moyen de paiement introuvable.
        </div>
        <LinkButton href="/payment-providers" variant="secondary">
          Retour aux moyens de paiement
        </LinkButton>
      </div>
    );
  }

  if (isLoading || !provider) {
    return (
      <div className={`${disputeFont.className} max-w-2xl space-y-5`}>
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-24" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  const typeLabel = PAYMENT_PROVIDER_TYPE_LABELS[provider.type] ?? provider.type;
  const countryLabel = provider.countryId
    ? (countries?.find((country) => country.id === provider.countryId)?.name ?? 'Pays spécifique')
    : 'Tous les pays';
  const unconfigured = configKeyCount(provider.config) === 0;

  return (
    <div className={`${disputeFont.className} max-w-2xl space-y-5 pb-4`}>
      <DisputeMotionStyles />

      <BackLink href="/payment-providers">Retour aux moyens de paiement</BackLink>

      {/* ---------- En-tête ---------- */}
      <div
        className={`dispute-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-xl ${
          provider.isActive
            ? 'from-[#0b62a3] via-[#0a4a7d] to-[#083a63] shadow-[#0a4a7d]/40'
            : 'from-slate-500 via-slate-600 to-slate-700 shadow-slate-600/30'
        }`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-4">
          <ProviderIcon type={provider.type} size="lg" onDark />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">{typeLabel}</p>
            <h1 className="mt-0.5 break-words text-2xl font-extrabold leading-tight tracking-tight">{provider.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-white/90">
              <IconWorld size={14} className="shrink-0" />
              {countryLabel}
            </p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <ActiveBadge active={provider.isActive} onDark />
          {unconfigured ? (
            <span className="inline-flex items-center rounded-full bg-black/20 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30">
              À configurer
            </span>
          ) : null}
        </div>
      </div>

      {/* ---------- Disponibilité ---------- */}
      <Panel title="Disponibilité" icon={<IconToggleRight size={18} />} delay={80}>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium text-slate-600">
            {provider.isActive
              ? 'Ce moyen de paiement est proposé aux clients.'
              : "Ce moyen de paiement n'est pas proposé aux clients."}
          </p>
          <ToggleSwitch
            checked={provider.isActive}
            disabled={toggleActive.isPending}
            onChange={(next) => toggleActive.mutate(next)}
            label={provider.isActive ? 'Désactiver ce moyen de paiement' : 'Activer ce moyen de paiement'}
          />
        </div>
      </Panel>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Panel title="Type de moyen de paiement" icon={<IconWallet size={18} />} delay={140}>
          <TypePicker value={type} options={TYPE_OPTIONS} onChange={(next) => setType(next as PaymentProviderType)} />
        </Panel>

        <Panel title="Informations" icon={<IconInfoCircle size={18} />} delay={200}>
          <div className="space-y-4">
            <InputField label="Nom affiché" value={name} onChange={(e) => setName(e.target.value)} required />
            <SelectField label="Pays (optionnel)" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
              <option value="">Disponible dans tous les pays</option>
              {(countries ?? []).map((country) => (
                <option key={country.id} value={country.id}>
                  {country.name}
                </option>
              ))}
            </SelectField>
          </div>
        </Panel>

        <Panel title="Configuration" icon={<IconSettings size={18} />} delay={260}>
          <TextAreaField
            label="Configuration (optionnel, JSON)"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={6}
          />
          <SecurityNote />
        </Panel>

        {errorMessage ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton type="submit" loading={updateProvider.isPending} className="w-full sm:w-auto">
            Enregistrer les modifications
          </ActionButton>
          <LinkButton href="/payment-providers" variant="secondary" className="w-full sm:w-auto">
            Annuler
          </LinkButton>
        </div>
      </form>
    </div>
  );
}