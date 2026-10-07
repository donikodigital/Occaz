// mobile/app/(driver)/news/[id].tsx
//
// [07/10/2026] v2 — Le contenu passe dans ArticleDetailScreen (partagé avec le client) : bandeau, chapeau, texte aéré.
// v1 — Détail d'un article.

import React from 'react';
import { ArticleDetailScreen } from '@/components/screens/ArticleDetailScreen';

export default function DriverArticleDetailScreen() {
  return <ArticleDetailScreen newsPath="/(driver)/news" />;
}
