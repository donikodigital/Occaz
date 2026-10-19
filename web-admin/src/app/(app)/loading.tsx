// web-admin/src/app/(app)/loading.tsx
// [19/10/2026] v1 — Chargement d'une page de l'espace connecté : le menu reste affiché, seule la zone de contenu montre l'indicateur.
import React from 'react';
import { PageLoading } from '@/components/layout/PageLoading';

export default function AppSectionLoading() {
  return <PageLoading />;
}
