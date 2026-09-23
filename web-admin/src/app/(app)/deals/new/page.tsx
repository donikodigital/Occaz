// web-admin/src/app/(app)/deals/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackHeader } from '@/components/admin/AdminUi';
import { DealForm, type DealFormValues } from '@/components/deals/DealForm';
import { useCreateDeal } from '@/hooks/usePromotions';
import { usePromoCodes } from '@/hooks/usePromotions';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function NewDealPage() {
  const router = useRouter();
  const { data: countries } = useCountries();
  const { data: promoCodesPage } = usePromoCodes();
  const createDeal = useCreateDeal();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(values: DealFormValues) {
    setErrorMessage(undefined);
    try {
      await createDeal.mutateAsync(values);
      router.replace('/deals');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader href="/deals" backLabel="Bons plans" title="Ajouter un bon plan" subtitle="Mets en avant une offre pour tes clients." />
      <DealForm mode="create" countries={countries ?? []} promoCodes={promoCodesPage?.data ?? []} isSubmitting={createDeal.isPending} errorMessage={errorMessage} onSubmit={handleSubmit} />
    </div>
  );
}