// web-admin/src/app/(app)/shipment-categories/new/page.tsx
//
// v2 — Refonte : en-tête avec retour, formulaire en cartes ombrées avec
// aperçu en direct (ShipmentCategoryForm, partagé avec la page Modifier).
// Après création, retour à la liste pour voir la nouvelle carte.

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackHeader } from '@/components/admin/AdminUi';
import { ShipmentCategoryForm, type ShipmentCategoryFormValues } from '@/components/shipmentCategories/ShipmentCategoryForm';
import { useCreateShipmentCategory } from '@/hooks/useShipmentCategories';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function NewShipmentCategoryPage() {
  const router = useRouter();
  const { data: countries } = useCountries();
  const createCategory = useCreateShipmentCategory();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(values: ShipmentCategoryFormValues) {
    setErrorMessage(undefined);
    try {
      await createCategory.mutateAsync(values);
      router.replace('/shipment-categories');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader
        href="/shipment-categories"
        backLabel="Catégories"
        title="Ajouter une catégorie d’envoi"
        subtitle="Définis un type de colis, où il s’applique et sa majoration de tarif."
      />

      <ShipmentCategoryForm
        mode="create"
        countries={countries ?? []}
        isSubmitting={createCategory.isPending}
        errorMessage={errorMessage}
        onSubmit={handleSubmit}
      />
    </div>
  );
}