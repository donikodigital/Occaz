// web-admin/src/app/(app)/deals/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackHeader, Notice } from '@/components/admin/AdminUi';
import { DealForm, type DealFormValues } from '@/components/deals/DealForm';
import { useDeal, useUpdateDeal, useDeleteDeal, usePromoCodes } from '@/hooks/usePromotions';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function EditDealPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: deal, isLoading, isError } = useDeal(id);
  const { data: countries } = useCountries();
  const { data: promoCodesPage } = usePromoCodes();
  const updateDeal = useUpdateDeal(id);
  const deleteDeal = useDeleteDeal();

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(values: DealFormValues) {
    setErrorMessage(undefined);
    setSaved(false);
    try {
      await updateDeal.mutateAsync(values);
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    try {
      await deleteDeal.mutateAsync(id);
      router.replace('/deals');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDelete(false);
    }
  }

  if (isError) {
    return (
      <div className="max-w-2xl space-y-6">
        <BackHeader href="/deals" backLabel="Bons plans" title="Bon plan introuvable" />
        <Notice tone="danger">Ce bon plan n'existe plus ou n'a pas pu être chargé.</Notice>
      </div>
    );
  }

  if (isLoading || !deal) {
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
        href="/deals"
        backLabel="Bons plans"
        title={deal.title}
        subtitle="Modifier le bon plan"
        badge={
          confirmingDelete ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-secondary">
                Annuler
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteDeal.isPending} className="rounded-xl bg-danger px-3 py-2 text-xs font-semibold text-white">
                Confirmer
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-danger shadow-sm transition hover:bg-danger-light/40">
              Supprimer
            </button>
          )
        }
      />
      <DealForm
        key={deal.id}
        mode="edit"
        countries={countries ?? []}
        promoCodes={promoCodesPage?.data ?? []}
        initial={deal}
        isSubmitting={updateDeal.isPending}
        errorMessage={errorMessage}
        saved={saved}
        onSubmit={handleSubmit}
      />
    </div>
  );
}