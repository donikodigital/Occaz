// web-admin/src/app/(app)/shipment-categories/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Button, Card, Select, Switch, TextField } from '@/components/ui';
import { useCreateShipmentCategory } from '@/hooks/useShipmentCategories';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function NewShipmentCategoryPage() {
  const router = useRouter();
  const { data: countries } = useCountries();
  const createCategory = useCreateShipmentCategory();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isAllowed, setIsAllowed] = useState(true);
  const [countryId, setCountryId] = useState('');
  const [priceMultiplier, setPriceMultiplier] = useState('1');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (name.trim().length < 2) {
      setErrorMessage('Renseignez un nom.');
      return;
    }
    const multiplier = Number(priceMultiplier.replace(',', '.'));
    if (!Number.isFinite(multiplier) || multiplier < 0) {
      setErrorMessage('La majoration de tarif doit être un nombre positif.');
      return;
    }

    try {
      const category = await createCategory.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        isAllowed,
        countryId: countryId || undefined,
        priceMultiplier: multiplier,
      });
      router.replace(`/shipment-categories/${category.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/shipment-categories" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Ajouter une catégorie d&apos;envoi</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Documents" required />
          <TextField
            label="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Select label="Pays (optionnel)" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">Règle globale (tous pays)</option>
            {(countries ?? []).map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
          <TextField
            label="Majoration de tarif"
            value={priceMultiplier}
            onChange={(e) => setPriceMultiplier(e.target.value)}
            hint="1 = tarif standard, 1.5 = +50%"
          />
          <Switch checked={isAllowed} onChange={setIsAllowed} label="Catégorie autorisée" />

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <Button type="submit" loading={createCategory.isPending}>
            Créer la catégorie
          </Button>
        </form>
      </Card>
    </div>
  );
}
