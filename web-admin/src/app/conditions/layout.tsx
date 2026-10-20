// web-admin/src/app/conditions/layout.tsx
//
// [20/10/2026] v1 — Page publique (sans connexion) : conditions générales. Indexable : l'adresse est celle déclarée dans la fiche Google Play.
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://occaz.sarl';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Conditions générales — Occa'Z",
  description: "Les règles d'utilisation d'Occa'Z : comptes, trajets, envoi de colis, paiements, responsabilités.",
  alternates: { canonical: '/conditions' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
