// web-admin/src/app/(app)/shipment-categories/[id]/page.tsx
//
// v2 — Refonte : même formulaire que la page Ajouter (ShipmentCategoryForm),
// pré-rempli. Le formulaire est monté une fois la catégorie chargée : sa
// saisie n'est plus écrasée par un rechargement après enregistrement.

'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { BackHeader, Chip, Notice } from '@/components/admin/AdminUi';
import { ShipmentCategoryForm, type ShipmentCategoryFormValues } from '@/components/shipmentCategories/ShipmentCategoryForm';
import { useShipmentCategory, useUpdateShipmentCategory } from '@/hooks/useShipmentCategories';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function EditShipmentCategoryPage() {
  const { id } = useParams<{ id: string }>();
  const { data: category, isLoading, isError } = useShipmentCategory(id);
  const { data: countries } = useCountries();
  const updateCategory = useUpdateShipmentCategory(id);

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(values: ShipmentCategoryFormValues) {
    setErrorMessage(undefined);
    setSaved(false);
    try {
      await updateCategory.mutateAsync(values);
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) {
    return (
      <div className="max-w-2xl space-y-6">
        <BackHeader href="/shipment-categories" backLabel="Catégories" title="Catégorie introuvable" />
        <Notice tone="danger">Cette catégorie n’existe plus ou n’a pas pu être chargée.</Notice>
      </div>
    );
  }

  if (isLoading || !category) {
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
        href="/shipment-categories"
        backLabel="Catégories"
        title={category.name}
        subtitle="Modifier la catégorie d’envoi"
        badge={<Chip tone={category.isAllowed ? 'success' : 'danger'}>{category.isAllowed ? 'Autorisée' : 'Interdite'}</Chip>}
      />

      <ShipmentCategoryForm
        key={category.id}
        mode="edit"
        countries={countries ?? []}
        initial={category}
        isSubmitting={updateCategory.isPending}
        errorMessage={errorMessage}
        saved={saved}
        onSubmit={handleSubmit}
      />
    </div>
  );
}