// web-admin/src/app/suppression-compte/layout.tsx
//
// [20/10/2026] v1 — Page publique (sans connexion) : comment supprimer son compte et ses données. Indexable : l'adresse est celle déclarée dans la fiche Google Play.
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://occaz.sarl';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Supprimer mon compte — Occa'Z",
  description: "Comment supprimer votre compte Occa'Z et vos données personnelles, depuis l'application ou en écrivant à l'assistance.",
  alternates: { canonical: '/suppression-compte' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
