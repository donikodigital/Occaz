// web-admin/src/app/(app)/settings/page.tsx
'use client';

import React, { useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextArea, TextField } from '@/components/ui';
import { usePlatformSettings, useRemovePlatformSetting, useUpsertPlatformSetting } from '@/hooks/usePlatformSettings';
import { ApiError } from '@/services/api/ApiError';

/** Réservé au SuperAdmin — SETTINGS_UPDATE n'est accordée à aucun des rôles Support du seed (voir rbac.seed.ts). */
export default function PlatformSettingsPage() {
  const { data: settings, isLoading, isError } = usePlatformSettings();
  const upsert = useUpsertPlatformSetting();
  const remove = useRemovePlatformSetting();

  const [key, setKey] = useState('');
  const [valueText, setValueText] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/.test(key)) {
      setErrorMessage('La clé doit suivre le format "domaine.parametre" (ex: trip.search_radius_km).');
      return;
    }

    let value: unknown;
    try {
      value = JSON.parse(valueText);
    } catch {
      setErrorMessage('La valeur doit être un JSON valide (ex: 25, "texte", true, {"a":1}).');
      return;
    }

    try {
      await upsert.mutateAsync({ key, value, description: description.trim() || undefined });
      setKey('');
      setValueText('');
      setDescription('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Paramètres plateforme</h1>
        <p className="text-sm text-text-secondary">
          Table clé/valeur générique (rayon de recherche, seuils, tarifs...) — toujours lue par le backend à
          l&apos;exécution, jamais codée en dur.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Clé" value={key} onChange={(e) => setKey(e.target.value)} placeholder="trip.search_radius_km" />
            <TextField label="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <TextArea
            label="Valeur (JSON)"
            value={valueText}
            onChange={(e) => setValueText(e.target.value)}
            placeholder="25"
            rows={2}
          />
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          <Button type="submit" loading={upsert.isPending}>
            Enregistrer
          </Button>
        </form>
      </Card>

      {isError ? (
        <p className="text-sm text-danger">
          Impossible de charger les paramètres — cette section exige la permission SETTINGS_UPDATE (SuperAdmin).
        </p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Clé</TableHeaderCell>
              <TableHeaderCell>Valeur</TableHeaderCell>
              <TableHeaderCell>Description</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(settings ?? []).map((setting) => (
              <TableRow key={setting.key} className="hover:bg-surface-muted/50">
                <TableCell className="font-mono text-xs">{setting.key}</TableCell>
                <TableCell className="font-mono text-xs text-text-secondary">{JSON.stringify(setting.value)}</TableCell>
                <TableCell className="text-text-secondary">{setting.description ?? '—'}</TableCell>
                <TableCell>
                  <button
                    onClick={() => remove.mutate(setting.key)}
                    className="text-text-muted hover:text-danger"
                    aria-label={`Supprimer ${setting.key}`}
                  >
                    <IconTrash size={16} />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
