// web-admin/src/components/deals/DealForm.tsx
'use client';

import React, { useState } from 'react';
import { Button, Select, TextArea, TextField } from '@/components/ui';
import { Chip, FormError, SavedNotice, SectionCard, ToggleRow } from '@/components/admin/AdminUi';
import type { Country } from '@/types/geography.types';
import type { Deal, PromoCode, UpsertDealPayload } from '@/types/promotions.types';

export interface DealFormValues extends UpsertDealPayload {}

interface DealFormProps {
  mode: 'create' | 'edit';
  countries: Country[];
  promoCodes: PromoCode[];
  initial?: Deal;
  isSubmitting: boolean;
  errorMessage?: string;
  saved?: boolean;
  onSubmit: (values: DealFormValues) => Promise<void> | void;
}

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function DealForm({ mode, countries, promoCodes, initial, isSubmitting, errorMessage, saved, onSubmit }: DealFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [promoCodeId, setPromoCodeId] = useState(initial?.promoCodeId ?? '');
  const [countryId, setCountryId] = useState(initial?.countryId ?? '');
  const [startsAt, setStartsAt] = useState(toDateInput(initial?.startsAt));
  const [expiresAt, setExpiresAt] = useState(toDateInput(initial?.expiresAt));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(String(initial?.sortOrder ?? 0));
  const [validationError, setValidationError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(undefined);
    if (title.trim().length < 3) {
      setValidationError('Renseigne un titre.');
      return;
    }
    if (description.trim().length < 3) {
      setValidationError('Renseigne une description.');
      return;
    }
    await onSubmit({
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl.trim() || undefined,
      promoCodeId: promoCodeId || undefined,
      countryId: countryId || undefined,
      startsAt: startsAt || undefined,
      expiresAt: expiresAt || undefined,
      isActive,
      sortOrder: Number(sortOrder) || 0,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-primary-light/40 p-4 shadow-md">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-2xl shadow-sm">🎟️</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-text-primary">{title.trim() || 'Nouveau bon plan'}</p>
          <p className="truncate text-sm text-text-secondary">{description.trim() || '—'}</p>
        </div>
        <Chip tone={isActive ? 'success' : 'danger'}>{isActive ? 'Actif' : 'Inactif'}</Chip>
      </div>

      <SectionCard title="Contenu">
        <TextField label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Offre de bienvenue" required />
        <TextArea label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Ce que le client va découvrir" />
        <TextField label="Image (URL, optionnel)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
      </SectionCard>

      <SectionCard title="Lien avec un code promo" description="Facultatif — la réduction elle-même reste gérée par le code promo choisi.">
        <Select label="Code promo associé" value={promoCodeId} onChange={(e) => setPromoCodeId(e.target.value)}>
          <option value="">Aucun</option>
          {promoCodes.map((promoCode) => (
            <option key={promoCode.id} value={promoCode.id}>
              {promoCode.code}
            </option>
          ))}
        </Select>
      </SectionCard>

      <SectionCard title="Portée et affichage">
        <Select label="Pays" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
          <option value="">Tous les pays</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </Select>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Visible à partir du (optionnel)" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <TextField label="Expire le (optionnel)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
        <TextField label="Ordre d'affichage" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} hint="Plus petit = affiché en premier" />
      </SectionCard>

      <SectionCard title="Statut">
        <ToggleRow checked={isActive} onChange={setIsActive} label="Bon plan actif" description="Quand il est désactivé, il n'est plus visible côté client." />
      </SectionCard>

      <FormError message={validationError ?? errorMessage} />
      {saved && mode === 'edit' ? <SavedNotice>Modifications enregistrées.</SavedNotice> : null}

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Créer le bon plan' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  );
}