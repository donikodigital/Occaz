// mobile/app/(customer)/search.tsx
// [08/10/2026] v1 — Recherche de l'accueil client (trajets, colis, chauffeurs, villes).
import React from 'react';
import { HomeSearchScreen } from '@/components/screens/HomeSearchScreen';

export default function CustomerSearchRoute() {
  return <HomeSearchScreen role="customer" />;
}
