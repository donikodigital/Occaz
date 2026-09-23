// web-admin/src/app/(app)/articles/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BackHeader, Notice } from '@/components/admin/AdminUi';
import { ArticleForm, type ArticleFormValues } from '@/components/articles/ArticleForm';
import { useArticleAdmin, useUpdateArticle, useDeleteArticle } from '@/hooks/usePromotions';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: article, isLoading, isError } = useArticleAdmin(id);
  const { data: countries } = useCountries();
  const updateArticle = useUpdateArticle(id);
  const deleteArticle = useDeleteArticle();

  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handleSubmit(values: ArticleFormValues) {
    setErrorMessage(undefined);
    setSaved(false);
    try {
      await updateArticle.mutateAsync(values);
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    try {
      await deleteArticle.mutateAsync(id);
      router.replace('/articles');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDelete(false);
    }
  }

  if (isError) {
    return (
      <div className="max-w-2xl space-y-6">
        <BackHeader href="/articles" backLabel="Actualités" title="Article introuvable" />
        <Notice tone="danger">Cet article n'existe plus ou n'a pas pu être chargé.</Notice>
      </div>
    );
  }

  if (isLoading || !article) {
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
        href="/articles"
        backLabel="Actualités"
        title={article.title}
        subtitle="Modifier l'article"
        badge={
          confirmingDelete ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmingDelete(false)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-text-secondary">
                Annuler
              </button>
              <button type="button" onClick={handleDelete} disabled={deleteArticle.isPending} className="rounded-xl bg-danger px-3 py-2 text-xs font-semibold text-white">
                Confirmer
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmingDelete(true)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-danger shadow-sm transition hover:bg-danger-light/40">
              Supprimer
            </button>
          )
        }
      />
      <ArticleForm
        key={article.id}
        mode="edit"
        countries={countries ?? []}
        initial={article}
        isSubmitting={updateArticle.isPending}
        errorMessage={errorMessage}
        saved={saved}
        onSubmit={handleSubmit}
      />
    </div>
  );
}