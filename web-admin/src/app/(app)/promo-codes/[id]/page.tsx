// web-admin/src/app/(app)/promo-codes/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackHeader, Chip, Notice } from '@/components/admin/AdminUi';
import { PromoCodeForm, type PromoCodeFormValues } from '@/components/promoCodes/PromoCodeForm';
import { usePromoCode, useUpdatePromoCode, useDeactivatePromoCode } from '@/hooks/usePromotions';
import { useCountries, useCurrencies } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function EditPromoCodePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: promoCode, isLoading, isError } = usePromoCode(id);
  const { data: countries } = useCountries();
  const { data: currencies } = useCurrencies();
  const updatePromoCode = useUpdatePromoCode(id);
  const deactivatePromoCode = useDeactivatePromoCode();

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(values: PromoCodeFormValues) {
    setErrorMessage(undefined);
    setSaved(false);
    try {
      await updatePromoCode.mutateAsync(values);
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) {
    return (
      <div className="max-w-2xl space-y-6">
        <BackHeader href="/promo-codes" backLabel="Codes promo" title="Code introuvable" />
        <Notice tone="danger">Ce code n'existe plus ou n'a pas pu être chargé.</Notice>
      </div>
    );
  }

  if (isLoading || !promoCode) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-10 w-40 animate-pulse rounded-xl bg-border/50" />
        <div className="h-24 animate-pulse rounded-2xl bg-border/50" />
        <div className="h-40 animate-pulse rounded-2xl bg-border/50" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader
        href="/promo-codes"
        backLabel="Codes promo"
        title={promoCode.code}
        subtitle="Modifier le code promo"
        badge={
          <button
            type="button"
            onClick={() => deactivatePromoCode.mutate(id)}
            disabled={!promoCode.isActive || deactivatePromoCode.isPending}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-danger shadow-sm transition hover:bg-danger-light/40 disabled:opacity-40"
          >
            Désactiver
          </button>
        }
      />
      <PromoCodeForm
        key={promoCode.id}
        mode="edit"
        countries={countries ?? []}
        currencies={currencies ?? []}
        initial={promoCode}
        isSubmitting={updatePromoCode.isPending}
        errorMessage={errorMessage}
        saved={saved}
        onSubmit={handleSubmit}
      />
    </div>
  );
}