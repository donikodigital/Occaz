// web-admin/src/components/promoCodes/PromoCodeForm.tsx
//
// Formulaire commun aux pages « Ajouter » et « Modifier » un code promo.

'use client';

import React, { useState } from 'react';
import { Button, Select, TextField } from '@/components/ui';
import { Chip, FormError, SavedNotice, SectionCard, ToggleRow } from '@/components/admin/AdminUi';
import type { Country } from '@/types/geography.types';
import type { Currency } from '@/types/geography.types';
import type { PromoCode, PromoDiscountType, ServiceType, UpsertPromoCodePayload } from '@/types/promotions.types';

export interface PromoCodeFormValues extends UpsertPromoCodePayload {}

interface PromoCodeFormProps {
  mode: 'create' | 'edit';
  countries: Country[];
  currencies: Currency[];
  initial?: PromoCode;
  isSubmitting: boolean;
  errorMessage?: string;
  saved?: boolean;
  onSubmit: (values: PromoCodeFormValues) => Promise<void> | void;
}

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function describeDiscount(type: PromoDiscountType, value: number): string {
  return type === 'PERCENTAGE' ? `${value}% de réduction` : `${value} de réduction fixe`;
}

export function PromoCodeForm({ mode, countries, currencies, initial, isSubmitting, errorMessage, saved, onSubmit }: PromoCodeFormProps) {
  const [code, setCode] = useState(initial?.code ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [discountType, setDiscountType] = useState<PromoDiscountType>(initial?.discountType ?? 'PERCENTAGE');
  const [discountValue, setDiscountValue] = useState(initial ? String(initial.discountValue) : '10');
  const [serviceType, setServiceType] = useState<ServiceType | ''>(initial?.serviceType ?? '');
  const [countryId, setCountryId] = useState(initial?.countryId ?? '');
  const [currencyId, setCurrencyId] = useState(initial?.currencyId ?? '');
  const [minAmount, setMinAmount] = useState(initial?.minAmount ?? '');
  const [maxDiscountAmount, setMaxDiscountAmount] = useState(initial?.maxDiscountAmount ?? '');
  const [usageLimit, setUsageLimit] = useState(initial?.usageLimit ? String(initial.usageLimit) : '');
  const [usageLimitPerUser, setUsageLimitPerUser] = useState(String(initial?.usageLimitPerUser ?? 1));
  const [startsAt, setStartsAt] = useState(toDateInput(initial?.startsAt));
  const [expiresAt, setExpiresAt] = useState(toDateInput(initial?.expiresAt));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [validationError, setValidationError] = useState<string | undefined>();

  const value = Number(discountValue.replace(',', '.'));
  const valueValid = discountValue.trim() !== '' && Number.isFinite(value) && value >= 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(undefined);

    if (code.trim().length < 3) {
      setValidationError('Le code doit contenir au moins 3 caractères.');
      return;
    }
    if (!valueValid) {
      setValidationError('La valeur de réduction doit être un nombre positif.');
      return;
    }
    if (discountType === 'FIXED_AMOUNT' && !currencyId) {
      setValidationError('Choisissez une devise pour un montant fixe.');
      return;
    }

    await onSubmit({
      code: code.trim().toUpperCase(),
      description: description.trim() || undefined,
      discountType,
      discountValue: value,
      serviceType: serviceType || undefined,
      countryId: countryId || undefined,
      currencyId: discountType === 'FIXED_AMOUNT' ? currencyId : undefined,
      minAmount: minAmount.trim() || undefined,
      maxDiscountAmount: maxDiscountAmount.trim() || undefined,
      usageLimit: usageLimit.trim() ? Number(usageLimit) : undefined,
      usageLimitPerUser: Number(usageLimitPerUser) || 1,
      startsAt: startsAt || undefined,
      expiresAt: expiresAt || undefined,
      isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-primary-light/40 p-4 shadow-md">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-lg font-bold text-primary shadow-sm">
          %
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-text-primary">{code.trim() || 'NOUVEAU-CODE'}</p>
          <p className="truncate text-sm text-text-secondary">{valueValid ? describeDiscount(discountType, value) : '—'}</p>
        </div>
        <Chip tone={isActive ? 'success' : 'danger'}>{isActive ? 'Actif' : 'Inactif'}</Chip>
      </div>

      <SectionCard title="Identité">
        <TextField label="Code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="BIENVENUE10" required />
        <TextField label="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Pour les nouveaux clients" />
      </SectionCard>

      <SectionCard title="Réduction">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Type" value={discountType} onChange={(e) => setDiscountType(e.target.value as PromoDiscountType)}>
            <option value="PERCENTAGE">Pourcentage</option>
            <option value="FIXED_AMOUNT">Montant fixe</option>
          </Select>
          <TextField label={discountType === 'PERCENTAGE' ? 'Pourcentage (%)' : 'Montant'} value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} placeholder="10" />
        </div>
        {discountType === 'FIXED_AMOUNT' ? (
          <Select label="Devise" value={currencyId} onChange={(e) => setCurrencyId(e.target.value)}>
            <option value="">— Choisir —</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.name} ({currency.isoCode})
              </option>
            ))}
          </Select>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Montant minimum (optionnel)" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
          <TextField label="Plafond de réduction (optionnel)" value={maxDiscountAmount} onChange={(e) => setMaxDiscountAmount(e.target.value)} placeholder="0" />
        </div>
      </SectionCard>

      <SectionCard title="Portée" description="Une règle globale vaut pour tous les pays ; sinon, elle ne concerne que le pays choisi.">
        <Select label="S'applique à" value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType | '')}>
          <option value="">Trajets et envois</option>
          <option value="TRIP">Trajets seulement</option>
          <option value="SHIPMENT">Envois seulement</option>
        </Select>
        <Select label="Pays" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
          <option value="">Tous les pays</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </Select>
      </SectionCard>

      <SectionCard title="Limites d'utilisation">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Utilisations totales (optionnel)" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} placeholder="Illimité" />
          <TextField label="Par client" value={usageLimitPerUser} onChange={(e) => setUsageLimitPerUser(e.target.value)} placeholder="1" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Actif à partir du (optionnel)" type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
          <TextField label="Expire le (optionnel)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        </div>
      </SectionCard>

      <SectionCard title="Statut">
        <ToggleRow checked={isActive} onChange={setIsActive} label="Code actif" description="Quand il est désactivé, le code n'est plus utilisable." />
        {mode === 'edit' && initial ? (
          <p className="text-xs text-text-muted">Utilisé {initial.usedCount} fois{initial.usageLimit ? ` sur ${initial.usageLimit} au total` : ''}.</p>
        ) : null}
      </SectionCard>

      <FormError message={validationError ?? errorMessage} />
      {saved && mode === 'edit' ? <SavedNotice>Modifications enregistrées.</SavedNotice> : null}

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? 'Créer le code' : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  );
}