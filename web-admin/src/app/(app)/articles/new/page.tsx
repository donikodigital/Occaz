// web-admin/src/app/(app)/articles/new/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BackHeader } from '@/components/admin/AdminUi';
import { ArticleForm, type ArticleFormValues } from '@/components/articles/ArticleForm';
import { useCreateArticle } from '@/hooks/usePromotions';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

export default function NewArticlePage() {
  const router = useRouter();
  const { data: countries } = useCountries();
  const createArticle = useCreateArticle();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(values: ArticleFormValues) {
    setErrorMessage(undefined);
    try {
      await createArticle.mutateAsync(values);
      router.replace('/articles');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <BackHeader href="/articles" backLabel="Actualités" title="Ajouter un article" subtitle="Rédige une actualité pour tes clients." />
      <ArticleForm mode="create" countries={countries ?? []} isSubmitting={createArticle.isPending} errorMessage={errorMessage} onSubmit={handleSubmit} />
    </div>
  );
}