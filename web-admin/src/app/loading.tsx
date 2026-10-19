// web-admin/src/app/loading.tsx
// [19/10/2026] v1 — Affiché pendant le chargement d'une page (avant : écran blanc).
import React from 'react';
import { PageLoading } from '@/components/layout/PageLoading';

export default function RootLoading() {
  return (
    <main className="min-h-screen bg-background">
      <PageLoading />
    </main>
  );
}
