// web-admin/src/components/shipmentCategories/ShipmentCategoryForm.tsx
//
// Formulaire commun aux pages « Ajouter » et « Modifier » une catégorie
// d'envoi. La page qui l'utilise gère l'appel API et la navigation ; ici :
// la saisie, la validation et un aperçu de la carte qui se met à jour.

'use client';

import React, { useState } from 'react';
import { IconPackage, IconPackageOff } from '@tabler/icons-react';
import { Button, Select, TextArea, TextField } from '@/components/ui';
import { Chip, FormError, SavedNotice, SectionCard, ToggleRow } from '@/components/admin/AdminUi';
import type { Country } from '@/types/geography.types';

export interface ShipmentCategoryFormValues {
  name: string;
  description?: string;
  isAllowed: boolean;
  countryId?: string;
  priceMultiplier: number;
}

interface ShipmentCategoryFormProps {
  mode: 'create' | 'edit';
  countries: Country[];
  initial?: {
    name: string;
    description?: string | null;
    isAllowed: boolean;
    countryId?: string | null;
    priceMultiplier: number | string;
  };
  isSubmitting: boolean;
  errorMessage?: string;
  saved?: boolean;
  onSubmit: (values: ShipmentCategoryFormValues) => Promise<void> | void;
}

/** Traduit le coefficient en langage courant : 1 = standard, 1.5 = +50 %… */
export function describeMultiplier(multiplier: number): string {
  if (!Number.isFinite(multiplier)) return '—';
  if (multiplier === 1) return 'Tarif standard';
  const percent = Math.round(Math.abs(multiplier - 1) * 100);
  return multiplier > 1 ? `+${percent} % sur le tarif standard` : `−${percent} % sur le tarif standard`;
}

export function ShipmentCategoryForm({
  mode,
  countries,
  initial,
  isSubmitting,
  errorMessage,
  saved,
  onSubmit,
}: ShipmentCategoryFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isAllowed, setIsAllowed] = useState(initial?.isAllowed ?? true);
  const [countryId, setCountryId] = useState(initial?.countryId ?? '');
  const [priceMultiplier, setPriceMultiplier] = useState(initial ? String(initial.priceMultiplier) : '1');
  const [validationError, setValidationError] = useState<string | undefined>();

  const multiplier = Number(priceMultiplier.replace(',', '.'));
  const multiplierValid = priceMultiplier.trim() !== '' && Number.isFinite(multiplier) && multiplier >= 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(undefined);

    if (name.trim().length < 2) {
      setValidationError('Renseignez un nom.');
      return;
    }
    if (!multiplierValid) {
      setValidationError('La majoration de tarif doit être un nombre positif.');
      return;
    }

    await onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      isAllowed,
      countryId: countryId || undefined,
      priceMultiplier: multiplier,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-primary-light/40 p-4 shadow-md">
        <span
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-sm ${
            isAllowed ? 'text-primary' : 'text-danger'
          }`}
        >
          {isAllowed ? <IconPackage size={26} /> : <IconPackageOff size={26} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-text-primary">{name.trim() || 'Nouvelle catégorie'}</p>
          <p className="truncate text-sm text-text-secondary">{multiplierValid ? describeMultiplier(multiplier) : '—'}</p>
        </div>
        <Chip tone={isAllowed ? 'success' : 'danger'}>{isAllowed ? 'Autorisée' : 'Interdite'}</Chip>
      </div>

      <SectionCard title="Informations">
        <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Documents" required />
        <TextArea
          label="Description (optionnel)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Ce que contient cette catégorie de colis"
        />
      </SectionCard>

      <SectionCard title="Où elle s’applique" description="Une règle globale vaut pour tous les pays ; sinon, elle ne concerne que le pays choisi.">
        <Select label="Pays" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
          <option value="">Règle globale (tous pays)</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </Select>
      </SectionCard>

      <SectionCard title="Tarification" description="Coefficient appliqué au tarif standard : 1 = inchangé, 1.5 = +50 %.">
        <TextField
          label="Majoration de tarif"
          value={priceMultiplier}
          onChange={(e) => setPriceMultiplier(e.target.value)}
          placeholder="1"
        />
        <p className={`text-sm font-medium ${multiplierValid ? 'text-primary' : 'text-danger'}`}>
          {multiplierValid ? `×${multiplier} — ${describeMultiplier(multiplier)}` : 'Saisis un nombre positif (ex. 1 ou 1.5).'}
        </p>
      </SectionCard>

      <SectionCard title="Autorisation">
        <ToggleRow
          checked={isAllowed}
          onChange={setIsAllowed}
          label="Catégorie autorisée"
          description="Quand elle est désactivée, les clients ne peuvent plus envoyer ce type de colis."
        />
      </SectionCard>

      <FormError message={validationError ?? errorMessage} />
      {saved && mode === 'edit' ? <SavedNotice>Modifications enregistrées.</SavedNotice> : null}

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Créer la catégorie' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  );
}