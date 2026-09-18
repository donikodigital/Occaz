// web-admin/src/components/geography/PrefectureFormModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button, Modal, TextField } from '@/components/ui';
import { useCreatePrefecture, useDeletePrefecture, useUpdatePrefecture } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';
import type { Prefecture } from '@/types/geography.types';

export interface PrefectureFormModalProps {
  open: boolean;
  onClose: () => void;
  prefecture: Prefecture | null;
  regionId: string;
}

/** Créer/renommer/supprimer une préfecture. Suppression bloquée côté backend tant qu'une ville en dépend (prefectures.service.ts). */
export function PrefectureFormModal({ open, onClose, prefecture, regionId }: PrefectureFormModalProps) {
  const createPrefecture = useCreatePrefecture();
  const updatePrefecture = useUpdatePrefecture(regionId);
  const deletePrefecture = useDeletePrefecture(regionId);

  const [name, setName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setName(prefecture?.name ?? '');
    setConfirmingDelete(false);
    setErrorMessage(undefined);
  }, [open, prefecture]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      if (prefecture) {
        await updatePrefecture.mutateAsync({ id: prefecture.id, name: name.trim() });
      } else {
        await createPrefecture.mutateAsync({ regionId, name: name.trim() });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    if (!prefecture) return;
    setErrorMessage(undefined);
    try {
      await deletePrefecture.mutateAsync(prefecture.id);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDelete(false);
    }
  }

  const saving = createPrefecture.isPending || updatePrefecture.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={prefecture ? prefecture.name : 'Ajouter une préfecture'}
      zIndex={60}
      footer={
        <>
          {prefecture ? (
            confirmingDelete ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-light/40 px-3 py-2">
                <span className="text-sm text-danger-dark">Supprimer cette préfecture ?</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" loading={deletePrefecture.isPending} onClick={handleDelete}>
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
              <Button type="submit" form="prefecture-form" loading={saving} disabled={!name.trim()}>
                {prefecture ? 'Enregistrer' : 'Créer la préfecture'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <form id="prefecture-form" onSubmit={handleSubmit} className="space-y-4">
        <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Préfecture de Labé" required autoFocus />
        {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
      </form>
    </Modal>
  );
}