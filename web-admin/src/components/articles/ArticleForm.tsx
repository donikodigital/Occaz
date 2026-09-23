// web-admin/src/components/articles/ArticleForm.tsx
'use client';

import React, { useState } from 'react';
import { Button, Select, TextArea, TextField } from '@/components/ui';
import { Chip, FormError, SavedNotice, SectionCard, ToggleRow } from '@/components/admin/AdminUi';
import type { Country } from '@/types/geography.types';
import type { Article, UpsertArticlePayload } from '@/types/promotions.types';

export interface ArticleFormValues extends UpsertArticlePayload {}

interface ArticleFormProps {
  mode: 'create' | 'edit';
  countries: Country[];
  initial?: Article;
  isSubmitting: boolean;
  errorMessage?: string;
  saved?: boolean;
  onSubmit: (values: ArticleFormValues) => Promise<void> | void;
}

function toDateInput(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 10) : '';
}

export function ArticleForm({ mode, countries, initial, isSubmitting, errorMessage, saved, onSubmit }: ArticleFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [coverImageUrl, setCoverImageUrl] = useState(initial?.coverImageUrl ?? '');
  const [countryId, setCountryId] = useState(initial?.countryId ?? '');
  const [publish, setPublish] = useState(Boolean(initial?.publishedAt));
  const [publishedAt, setPublishedAt] = useState(toDateInput(initial?.publishedAt) || new Date().toISOString().slice(0, 10));
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [validationError, setValidationError] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setValidationError(undefined);
    if (title.trim().length < 3) {
      setValidationError('Renseigne un titre.');
      return;
    }
    if (content.trim().length < 10) {
      setValidationError("Le contenu de l'article est trop court.");
      return;
    }
    await onSubmit({
      title: title.trim(),
      excerpt: excerpt.trim() || undefined,
      content: content.trim(),
      coverImageUrl: coverImageUrl.trim() || undefined,
      countryId: countryId || undefined,
      publishedAt: publish ? new Date(publishedAt).toISOString() : undefined,
      isActive,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="flex items-center gap-4 rounded-2xl border border-border bg-primary-light/40 p-4 shadow-md">
        {coverImageUrl ? (
          <img src={coverImageUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-sm" />
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-2xl shadow-sm">📰</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-text-primary">{title.trim() || 'Nouvel article'}</p>
          <p className="truncate text-sm text-text-secondary">{excerpt.trim() || '—'}</p>
        </div>
        <Chip tone={publish ? 'success' : 'neutral'}>{publish ? 'Publié' : 'Brouillon'}</Chip>
      </div>

      <SectionCard title="Contenu">
        <TextField label="Titre" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Nouveauté dans l'application" required />
        <TextField label="Résumé (optionnel)" value={excerpt} onChange={(e) => setExcerpt(e.target.value)} placeholder="Affiché dans la liste des actualités" />
        <TextArea label="Contenu" value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="Texte complet de l'article" />
        <TextField label="Image de couverture (URL, optionnel)" value={coverImageUrl} onChange={(e) => setCoverImageUrl(e.target.value)} placeholder="https://…" />
      </SectionCard>

      <SectionCard title="Portée">
        <Select label="Pays" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
          <option value="">Tous les pays</option>
          {countries.map((country) => (
            <option key={country.id} value={country.id}>
              {country.name}
            </option>
          ))}
        </Select>
      </SectionCard>

      <SectionCard title="Publication">
        <ToggleRow checked={publish} onChange={setPublish} label="Publié" description="Tant que c'est désactivé, l'article reste un brouillon invisible côté client." />
        {publish ? <TextField label="Date de publication" type="date" value={publishedAt} onChange={(e) => setPublishedAt(e.target.value)} /> : null}
        <ToggleRow checked={isActive} onChange={setIsActive} label="Actif" description="Désactive l'article sans le supprimer." />
      </SectionCard>

      <FormError message={validationError ?? errorMessage} />
      {saved && mode === 'edit' ? <SavedNotice>Modifications enregistrées.</SavedNotice> : null}

      <div className="flex justify-end">
        <Button type="submit" loading={isSubmitting}>
          {mode === 'create' ? "Créer l'article" : 'Enregistrer les modifications'}
        </Button>
      </div>
    </form>
  );
}