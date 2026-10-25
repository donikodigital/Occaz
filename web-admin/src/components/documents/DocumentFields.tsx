// web-admin/src/components/documents/DocumentFields.tsx
// [25/10/2026] v1 — Les champs d'une fiche de document (titre, catégorie, date, description, « Réservé »), communs à l'ajout et à la modification.
'use client';

import React from 'react';
import { Select, TextArea, TextField } from '@/components/ui';
import { ToggleRow } from '@/components/admin/AdminUi';
import { CATEGORY_HINTS, CATEGORY_LABELS, CATEGORY_ORDER } from '@/utils/companyDocuments';
import type { CompanyDocumentCategory, CompanyDocumentFields } from '@/types/company-documents.types';

export function DocumentFields({
  value,
  onChange,
  disabled = false,
}: {
  value: CompanyDocumentFields;
  onChange: (next: CompanyDocumentFields) => void;
  disabled?: boolean;
}) {
  const set = <K extends keyof CompanyDocumentFields>(key: K, next: CompanyDocumentFields[K]) => onChange({ ...value, [key]: next });
  const isMinutes = value.category === 'MEETING_MINUTES';

  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-70">
      <TextField
        label="Titre"
        value={value.title}
        maxLength={150}
        placeholder="Ex. : PV de la réunion du bureau — octobre 2026"
        onChange={(event) => set('title', event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Select label="Catégorie" value={value.category} onChange={(event) => set('category', event.target.value as CompanyDocumentCategory)}>
            {CATEGORY_ORDER.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABELS[key]}
              </option>
            ))}
          </Select>
          <p className="mt-1.5 text-xs text-text-muted">{CATEGORY_HINTS[value.category]}</p>
        </div>
        <TextField
          label={isMinutes ? 'Date de la réunion' : 'Date du document'}
          type="date"
          value={value.documentDate}
          onChange={(event) => set('documentDate', event.target.value)}
          hint="Facultatif"
        />
      </div>
      <TextArea
        label="Description"
        rows={3}
        maxLength={1000}
        value={value.description}
        placeholder="Facultatif : participants, sujets abordés, remarques…"
        onChange={(event) => set('description', event.target.value)}
      />
      <ToggleRow
        checked={value.restricted}
        onChange={(checked) => set('restricted', checked)}
        label="Document réservé"
        description="Visible uniquement par les SuperAdmin et par la personne qui l'a déposé."
      />
    </fieldset>
  );
}
