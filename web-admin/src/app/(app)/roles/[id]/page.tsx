// web-admin/src/app/(app)/roles/[id]/page.tsx
//
// v2 — Refonte : même formulaire que la page Créer (RoleForm), pré-rempli.
// La clé du rôle est figée. Le formulaire est monté une fois le rôle ET le
// catalogue chargés : la sélection de permissions n'est plus écrasée par un
// rechargement après l'enregistrement.

'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { BackHeader, Chip, ListSkeleton, Notice } from '@/components/admin/AdminUi';
import { RoleForm, type RoleFormValues } from '@/components/roles/RoleForm';
import { usePermissionsCatalog, useRole, useUpdateRole } from '@/hooks/useRbac';
import { ApiError } from '@/services/api/ApiError';

export default function EditRolePage() {
  const { id } = useParams<{ id: string }>();
  const { data: role, isLoading, isError } = useRole(id);
  const { data: permissions } = usePermissionsCatalog();
  const updateRole = useUpdateRole(id);

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  async function handleSubmit(values: RoleFormValues) {
    setErrorMessage(undefined);
    setSaved(false);
    try {
      // La clé identifie le rôle et ne se modifie pas : elle n'est pas envoyée.
      await updateRole.mutateAsync({
        name: values.name,
        description: values.description,
        permissionKeys: values.permissionKeys,
      });
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) {
    return (
      <div className="max-w-2xl space-y-6">
        <BackHeader href="/roles" backLabel="Rôles" title="Rôle introuvable" />
        <Notice tone="danger">Ce rôle n’existe plus ou n’a pas pu être chargé.</Notice>
      </div>
    );
  }

  if (isLoading || !role || !permissions) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-10 w-32 animate-pulse rounded-xl bg-border/50" />
        <ListSkeleton count={2} heightClass="h-40" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader
        href="/roles"
        backLabel="Rôles"
        title={role.name}
        subtitle="Modifier le rôle et ses permissions"
        badge={<Chip tone="neutral">{role.key}</Chip>}
      />

      <RoleForm
        key={role.id}
        mode="edit"
        permissions={permissions}
        initial={{
          key: role.key,
          name: role.name,
          description: role.description,
          permissionKeys: role.permissions.map((link) => link.permission.key),
        }}
        isSubmitting={updateRole.isPending}
        errorMessage={errorMessage}
        saved={saved}
        onSubmit={handleSubmit}
      />
    </div>
  );
}