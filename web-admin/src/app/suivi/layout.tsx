// web-admin/src/app/suivi/layout.tsx
//
// [20/10/2026] v1 — Pages publiques de suivi de colis (/suivi et /suivi/<numéro>), ouvertes depuis le lien des e-mails et SMS de suivi.
// Non indexées (un numéro de suivi n'a pas à apparaître dans un moteur de recherche) et sans « referrer » sortant.
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://occaz.sarl';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Suivre mon colis — Occa'Z",
  description: "Suivez votre colis Occa'Z étape par étape avec son numéro de suivi, sans créer de compte.",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
