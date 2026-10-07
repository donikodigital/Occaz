// web-admin/src/app/rejoindre/layout.tsx
//
// [07/10/2026] v1 — Page publique d'invitation (voir page.tsx). Ce layout, côté serveur, porte les métadonnées : c'est lui qui
// donne le titre, la description et l'image de l'aperçu quand le lien est partagé sur WhatsApp, Messenger ou par SMS.
// La page n'est pas indexée par les moteurs de recherche : chaque lien contient le code personnel d'un parrain.
import type { Metadata } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'https://occaz.sarl';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Rejoignez Occa'Z",
  description: "Voyagez en partage et envoyez vos colis avec Occa'Z. Un ami vous invite : installez l'application et utilisez son code de parrainage.",
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: "Occa'Z",
    locale: 'fr_FR',
    title: "Rejoignez-moi sur Occa'Z",
    description: "Transport partagé et envoi de colis. Installez l'application et utilisez mon code de parrainage.",
    images: [{ url: '/brand/logo.png', width: 512, height: 512, alt: "Occa'Z" }],
  },
  twitter: { card: 'summary', title: "Rejoignez-moi sur Occa'Z" },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return children;
}
