// web-admin/src/app/(app)/articles/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { IconChevronRight, IconPlus, IconSearch, IconSpeakerphone } from '@tabler/icons-react';
import { Chip, EmptyState, FilterChips, LinkButton, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { useArticles } from '@/hooks/usePromotions';
import type { Article } from '@/types/promotions.types';

type StatusFilter = 'published' | 'draft';

function ArticleCard({ article }: { article: Article }) {
  const isPublished = Boolean(article.publishedAt && new Date(article.publishedAt) <= new Date());
  return (
    <Link
      href={`/articles/${article.id}`}
      className={`group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${
        article.isActive ? '' : 'opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        {article.coverImageUrl ? (
          <img src={article.coverImageUrl} alt="" className="h-12 w-12 shrink-0 rounded-2xl object-cover" />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-light text-xl">📰</span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{article.title}</p>
          {article.excerpt ? <p className="line-clamp-2 text-xs text-text-secondary">{article.excerpt}</p> : null}
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-auto flex flex-wrap gap-2">
        {isPublished ? <Chip tone="success">Publié</Chip> : <Chip tone="neutral">Brouillon</Chip>}
        {!article.isActive ? <Chip tone="danger">Inactif</Chip> : null}
      </div>
    </Link>
  );
}

export default function ArticlesPage() {
  const { data: articlesPage, isLoading, isError } = useArticles();
  const [status, setStatus] = useState<StatusFilter | ''>('');
  const [search, setSearch] = useState('');

  const all = articlesPage?.data ?? [];
  const publishedCount = all.filter((a) => a.publishedAt && new Date(a.publishedAt) <= new Date()).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return all.filter((a) => {
      const isPublished = Boolean(a.publishedAt && new Date(a.publishedAt) <= new Date());
      if (status === 'published' && !isPublished) return false;
      if (status === 'draft' && isPublished) return false;
      if (!query) return true;
      return a.title.toLowerCase().includes(query);
    });
  }, [all, status, search]);

  const hasFilters = status !== '' || search.trim() !== '';

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Informations"
        title="Actualités"
        description="Articles visibles par les clients dans l'application."
        stats={[
          { value: articlesPage ? String(all.length) : '…', label: all.length > 1 ? 'articles' : 'article' },
          { value: articlesPage ? String(publishedCount) : '…', label: publishedCount > 1 ? 'publiés' : 'publié' },
        ]}
      />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un article…"
            className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <LinkButton href="/articles/new" icon={<IconPlus size={16} />}>
          Ajouter
        </LinkButton>
      </div>

      <FilterChips
        value={status}
        onChange={setStatus}
        options={[
          { value: 'published', label: 'Publiés' },
          { value: 'draft', label: 'Brouillons' },
        ]}
        allLabel="Tous"
      />

      {isError ? (
        <Notice tone="danger">Impossible de charger les actualités.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-36" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<IconSpeakerphone size={26} />}
          title={hasFilters ? 'Aucun article ne correspond' : 'Aucune actualité'}
          text={hasFilters ? 'Essaie une autre recherche ou retire le filtre.' : 'Publie ta première actualité.'}
          action={<LinkButton href="/articles/new" icon={<IconPlus size={16} />}>Ajouter un article</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((article) => (
            <ArticleCard key={article.id} article={article} />
          ))}
        </div>
      )}
    </div>
  );
}