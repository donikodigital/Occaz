// web-admin/src/app/(app)/translations/page.tsx
'use client';

import React, { useState } from 'react';
import { IconTrash } from '@tabler/icons-react';
import { Button, Card, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@/components/ui';
import { useRemoveTranslation, useTranslationsList, useUpsertTranslation } from '@/hooks/useTranslations';
import { ApiError } from '@/services/api/ApiError';

export default function TranslationsPage() {
  const [entityTypeFilter, setEntityTypeFilter] = useState('');
  const { data, isLoading, isError } = useTranslationsList({ entityType: entityTypeFilter || undefined });
  const upsert = useUpsertTranslation();
  const remove = useRemoveTranslation();

  const [entityType, setEntityType] = useState('');
  const [entityId, setEntityId] = useState('');
  const [locale, setLocale] = useState('en');
  const [field, setField] = useState('');
  const [value, setValue] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (!entityType.trim() || !entityId.trim() || !field.trim() || !value.trim()) {
      setErrorMessage('Tous les champs sont requis (sauf la langue, déjà pré-remplie).');
      return;
    }

    try {
      await upsert.mutateAsync({ entityType: entityType.trim(), entityId: entityId.trim(), locale, field: field.trim(), value: value.trim() });
      setEntityId('');
      setField('');
      setValue('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Traductions</h1>
        <p className="text-sm text-text-secondary">
          Table générique — traduit un champ (<code>field</code>) d&apos;un enregistrement (<code>entityType</code> +{' '}
          <code>entityId</code>) dans une langue donnée. Français au lancement, langues suivantes ensuite.
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <TextField label="Type d'entité" value={entityType} onChange={(e) => setEntityType(e.target.value)} placeholder="ShipmentCategory" />
          <TextField label="Id de l'enregistrement" value={entityId} onChange={(e) => setEntityId(e.target.value)} />
          <TextField label="Langue" value={locale} onChange={(e) => setLocale(e.target.value)} placeholder="en" />
          <TextField label="Champ" value={field} onChange={(e) => setField(e.target.value)} placeholder="name" />
          <TextField label="Valeur traduite" value={value} onChange={(e) => setValue(e.target.value)} />
          <div className="col-span-2 sm:col-span-5">
            {errorMessage ? <p className="mb-2 text-sm text-danger">{errorMessage}</p> : null}
            <Button type="submit" loading={upsert.isPending}>
              Enregistrer
            </Button>
          </div>
        </form>
      </Card>

      <TextField
        value={entityTypeFilter}
        onChange={(e) => setEntityTypeFilter(e.target.value)}
        placeholder="Filtrer par type d'entité…"
        className="max-w-xs"
      />

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les traductions.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Entité</TableHeaderCell>
              <TableHeaderCell>Champ</TableHeaderCell>
              <TableHeaderCell>Langue</TableHeaderCell>
              <TableHeaderCell>Valeur</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(data?.data ?? []).map((translation) => (
              <TableRow key={`${translation.entityType}-${translation.entityId}-${translation.locale}-${translation.field}`} className="hover:bg-surface-muted/50">
                <TableCell className="font-mono text-xs">
                  {translation.entityType} · {translation.entityId.slice(0, 8)}…
                </TableCell>
                <TableCell className="text-text-secondary">{translation.field}</TableCell>
                <TableCell className="text-text-secondary">{translation.locale}</TableCell>
                <TableCell>{translation.value}</TableCell>
                <TableCell>
                  <button
                    onClick={() =>
                      remove.mutate({
                        entityType: translation.entityType,
                        entityId: translation.entityId,
                        locale: translation.locale,
                        field: translation.field,
                      })
                    }
                    className="text-text-muted hover:text-danger"
                    aria-label="Supprimer"
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
