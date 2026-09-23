// web-admin/src/app/(app)/promo-codes/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackHeader } from '@/components/admin/AdminUi';
import { PromoCodeForm, type PromoCodeFormValues } from '@/components/promoCodes/PromoCodeForm';
import { useCreatePromoCode } from '@/hooks/usePromotions';
import { useCountries, useCurrencies } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function NewPromoCodePage() {
  const router = useRouter();
  const { data: countries } = useCountries();
  const { data: currencies } = useCurrencies();
  const createPromoCode = useCreatePromoCode();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(values: PromoCodeFormValues) {
    setErrorMessage(undefined);
    try {
      await createPromoCode.mutateAsync(values);
      router.replace('/promo-codes');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader href="/promo-codes" backLabel="Codes promo" title="Ajouter un code promo" subtitle="Définis la réduction, sa portée et ses limites d'utilisation." />
      <PromoCodeForm mode="create" countries={countries ?? []} currencies={currencies ?? []} isSubmitting={createPromoCode.isPending} errorMessage={errorMessage} onSubmit={handleSubmit} />
    </div>
  );
}