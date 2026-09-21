// web-admin/src/app/(app)/roles/new/page.tsx
//
// v2 — Refonte : en-tête avec retour, formulaire en cartes ombrées avec les
// permissions regroupées par domaine (RoleForm, partagé avec la page
// Modifier). Après création, ouverture du rôle créé (comme avant).

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackHeader, ListSkeleton } from '@/components/admin/AdminUi';
import { RoleForm, type RoleFormValues } from '@/components/roles/RoleForm';
import { useCreateRole, usePermissionsCatalog } from '@/hooks/useRbac';
import { ApiError } from '@/services/api/ApiError';

export default function NewRolePage() {
  const router = useRouter();
  const { data: permissions } = usePermissionsCatalog();
  const createRole = useCreateRole();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(values: RoleFormValues) {
    setErrorMessage(undefined);
    try {
      const role = await createRole.mutateAsync(values);
      router.replace(`/roles/${role.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader
        href="/roles"
        backLabel="Rôles"
        title="Créer un rôle"
        subtitle="Donne-lui un nom, puis choisis ce qu’il a le droit de faire."
      />

      {permissions ? (
        <RoleForm
          mode="create"
          permissions={permissions}
          isSubmitting={createRole.isPending}
          errorMessage={errorMessage}
          onSubmit={handleSubmit}
        />
      ) : (
        <ListSkeleton count={2} heightClass="h-40" />
      )}
    </div>
  );
}