// web-admin/src/components/geography/RegionFormModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button, Modal, TextField } from '@/components/ui';
import { useCreateRegion, useDeleteRegion, useUpdateRegion } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';
import type { Region } from '@/types/geography.types';

export interface RegionFormModalProps {
  open: boolean;
  onClose: () => void;
  region: Region | null;
  countryId: string;
}

/** Créer/renommer/supprimer une région. Suppression bloquée côté backend tant qu'une préfecture en dépend (regions.service.ts). */
export function RegionFormModal({ open, onClose, region, countryId }: RegionFormModalProps) {
  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion(countryId);
  const deleteRegion = useDeleteRegion(countryId);

  const [name, setName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(region?.name ?? '');
    setConfirmingDelete(false);
    setErrorMessage(undefined);
  }, [open, region]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      if (region) {
        await updateRegion.mutateAsync({ id: region.id, name: name.trim() });
      } else {
        await createRegion.mutateAsync({ countryId, name: name.trim() });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    if (!region) return;
    setErrorMessage(undefined);
    try {
      await deleteRegion.mutateAsync(region.id);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDelete(false);
    }
  }

  const saving = createRegion.isPending || updateRegion.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={region ? region.name : 'Ajouter une région'}
      zIndex={60}
      footer={
        <>
          {region ? (
            confirmingDelete ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-light/40 px-3 py-2">
                <span className="text-sm text-danger-dark">Supprimer cette région ?</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" loading={deleteRegion.isPending} onClick={handleDelete}>
                    Confirmer
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)} className="mr-auto">
                <IconTrash size={16} />
                Supprimer
              </Button>
            )
          ) : null}
          {!confirmingDelete ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" form="region-form" loading={saving} disabled={!name.trim()}>
                {region ? 'Enregistrer' : 'Créer la région'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <form id="region-form" onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Région de Labé" required autoFocus />
        {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
      </form>
    </Modal>
  );
}