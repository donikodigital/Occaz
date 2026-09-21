// web-admin/src/app/(app)/payment-providers/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconInfoCircle, IconSettings, IconWallet } from '@tabler/icons-react';
import { useCreatePaymentProvider } from '@/hooks/usePaymentProviders';
import { useCountries } from '@/hooks/useGeography';
import { PAYMENT_PROVIDER_TYPE_LABELS } from '@/utils/paymentProviderLabels';
import { ApiError } from '@/services/api/ApiError';
import {
  ActionButton,
  DisputeMotionStyles,
  InputField,
  Panel,
  SelectField,
  TextAreaField,
  disputeFont,
} from '@/components/disputes/disputeUi';
import { BackLink, LinkButton, SecurityNote, TypePicker } from '@/components/paymentProviders/paymentUi';
import type { PaymentProviderType } from '@/types/paymentProviders.types';

const PROVIDER_TYPES = Object.keys(PAYMENT_PROVIDER_TYPE_LABELS) as PaymentProviderType[];
const TYPE_OPTIONS = PROVIDER_TYPES.map((value) => ({ value, label: PAYMENT_PROVIDER_TYPE_LABELS[value] }));

export default function NewPaymentProviderPage() {
  const router = useRouter();
  const { data: countries } = useCountries();
  const createProvider = useCreatePaymentProvider();

  const [type, setType] = useState<PaymentProviderType>('ORANGE_MONEY');
  const [name, setName] = useState('');
  const [countryId, setCountryId] = useState('');
  const [configText, setConfigText] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

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
      const provider = await createProvider.mutateAsync({
        type,
        name: name.trim(),
        countryId: countryId || undefined,
        config,
      });
      router.replace(`/payment-providers/${provider.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className={`${disputeFont.className} max-w-2xl space-y-5 pb-4`}>
      <DisputeMotionStyles />

      <BackLink href="/payment-providers">Retour aux moyens de paiement</BackLink>

      <header className="dispute-fade-up flex items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
          <IconWallet size={24} />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Ajouter un moyen de paiement</h1>
          <p className="text-sm font-medium text-slate-500">Choisissez un type, puis renseignez ses informations.</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Panel title="Type de moyen de paiement" icon={<IconWallet size={18} />} delay={60}>
          <TypePicker value={type} options={TYPE_OPTIONS} onChange={(next) => setType(next as PaymentProviderType)} />
        </Panel>

        <Panel title="Informations" icon={<IconInfoCircle size={18} />} delay={120}>
          <div className="space-y-4">
            <InputField
              label="Nom affiché"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Orange Money Guinée"
              required
            />
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

        <Panel title="Configuration" icon={<IconSettings size={18} />} delay={180}>
          <TextAreaField
            label="Configuration (optionnel, JSON)"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            placeholder={'{\n  "merchantId": "..."\n}'}
            rows={5}
          />
          <p className="mt-1.5 text-xs text-slate-400">
            Facultatif : la configuration peut être complétée plus tard depuis la fiche du moyen de paiement.
          </p>
          <SecurityNote />
        </Panel>

        {errorMessage ? (
          <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            {errorMessage}
          </p>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <ActionButton type="submit" loading={createProvider.isPending} className="w-full sm:w-auto">
            Créer le moyen de paiement
          </ActionButton>
          <LinkButton href="/payment-providers" variant="secondary" className="w-full sm:w-auto">
            Annuler
          </LinkButton>
        </div>
      </form>
    </div>
  );
}