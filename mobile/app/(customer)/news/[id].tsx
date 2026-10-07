// mobile/app/(customer)/news/[id].tsx
//
// [07/10/2026] v2 — Le contenu passe dans ArticleDetailScreen (partagé avec le conducteur) : bandeau, chapeau, texte aéré.
// v1 — Détail d'un article. Le client ouvrait cette route depuis la liste des actualités sans que l'écran existe (« Unmatched Route »).

import React from 'react';
import { ArticleDetailScreen } from '@/components/screens/ArticleDetailScreen';

export default function CustomerArticleDetailScreen() {
  return <ArticleDetailScreen newsPath="/(customer)/news" />;
}
