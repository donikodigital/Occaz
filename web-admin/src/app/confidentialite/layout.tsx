// web-admin/src/app/confidentialite/layout.tsx
//
// [20/10/2026] v1 — Page publique (sans connexion) : politique de confidentialité. Indexable : l'adresse est celle déclarée dans la fiche Google Play.
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://occaz.sarl';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Politique de confidentialité — Occa'Z",
  description: "Quelles données Occa'Z collecte, pourquoi, avec qui elles sont partagées, combien de temps elles sont conservées et comment exercer vos droits.",
  alternates: { canonical: '/confidentialite' },
  robots: { index: true, follow: true },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
