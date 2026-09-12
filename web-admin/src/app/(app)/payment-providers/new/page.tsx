// web-admin/src/app/(app)/payment-providers/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Button, Card, Select, TextArea, TextField } from '@/components/ui';
import { useCreatePaymentProvider } from '@/hooks/usePaymentProviders';
import { useCountries } from '@/hooks/useGeography';
import { PAYMENT_PROVIDER_TYPE_LABELS } from '@/utils/paymentProviderLabels';
import { ApiError } from '@/services/api/ApiError';
import type { PaymentProviderType } from '@/types/paymentProviders.types';

const PROVIDER_TYPES = Object.keys(PAYMENT_PROVIDER_TYPE_LABELS) as PaymentProviderType[];

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
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/payment-providers" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Ajouter un moyen de paiement</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Select label="Type" value={type} onChange={(e) => setType(e.target.value as PaymentProviderType)}>
            {PROVIDER_TYPES.map((value) => (
              <option key={value} value={value}>
                {PAYMENT_PROVIDER_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>

          <TextField
            label="Nom affiché"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex : Orange Money Guinée"
            required
          />

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
            placeholder={'{\n  "merchantId": "..."\n}'}
            rows={5}
            hint="Identifiants publics uniquement (endpoint, identifiant marchand...) — jamais de secret, qui reste en variable d'environnement côté backend."
          />

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <Button type="submit" loading={createProvider.isPending}>
            Créer le moyen de paiement
          </Button>
        </form>
      </Card>
    </div>
  );
}
