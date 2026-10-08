// mobile/app/(driver)/search.tsx
// [08/10/2026] v1 — Recherche de l'accueil conducteur (ses trajets et ses envois acceptés).
import React from 'react';
import { HomeSearchScreen } from '@/components/screens/HomeSearchScreen';

export default function DriverSearchRoute() {
  return <HomeSearchScreen role="driver" />;
}
