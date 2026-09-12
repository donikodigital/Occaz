// web-admin/src/app/(app)/payment-providers/[id]/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Badge, Button, Card, Select, Switch, TextArea, TextField } from '@/components/ui';
import {
  usePaymentProvider,
  useTogglePaymentProviderActive,
  useUpdatePaymentProvider,
} from '@/hooks/usePaymentProviders';
import { useCountries } from '@/hooks/useGeography';
import { PAYMENT_PROVIDER_TYPE_LABELS } from '@/utils/paymentProviderLabels';
import { ApiError } from '@/services/api/ApiError';
import type { PaymentProviderType } from '@/types/paymentProviders.types';

const PROVIDER_TYPES = Object.keys(PAYMENT_PROVIDER_TYPE_LABELS) as PaymentProviderType[];

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
    return <p className="text-sm text-danger">Moyen de paiement introuvable.</p>;
  }
  if (isLoading || !provider) {
    return <p className="text-sm text-text-secondary">Chargement…</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/payment-providers" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">{provider.name}</h1>
      </div>

      <Card className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge label={provider.isActive ? 'Actif' : 'Inactif'} tone={provider.isActive ? 'success' : 'neutral'} />
          <span className="text-sm text-text-secondary">
            {provider.isActive
              ? 'Ce moyen de paiement est proposé aux clients.'
              : "Ce moyen de paiement n'est pas proposé aux clients."}
          </span>
        </div>
        <Switch checked={provider.isActive} disabled={toggleActive.isPending} onChange={(next) => toggleActive.mutate(next)} />
      </Card>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as PaymentProviderType)}>
            {PROVIDER_TYPES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_PROVIDER_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>

          <TextField label="Nom affiché" value={name} onChange={(e) => setName(e.target.value)} required />

          <Select label="Pays (optionnel)" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">Disponible dans tous les pays</option>
            {(countries ?? []).map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>

          <TextArea
            label="Configuration (optionnel, JSON)"
            value={configText}
            onChange={(e) => setConfigText(e.target.value)}
            rows={5}
            hint="Identifiants publics uniquement — jamais de secret."
          />

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <Button type="submit" loading={updateProvider.isPending}>
            Enregistrer les modifications
          </Button>
        </form>
      </Card>
    </div>
  );
}
