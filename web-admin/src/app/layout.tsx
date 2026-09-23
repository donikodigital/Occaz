// web-admin/src/app/layout.tsx
// [23/09/2026] v+ — Restauré : ce fichier avait été écrasé par erreur avec
// le contenu de app/(app)/layout.tsx (commit f78d317), ce qui supprimait
// <html>/<body>, les polices, les métadonnées et Providers — cassant
// entre autres la page de connexion, hors du groupe (app). Le vrai layout
// du groupe authentifié reste dans app/(app)/layout.tsx, inchangé.
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from '@/components/layout/Providers';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'Occaz Go — Transport Partagé',
  description: 'Administration de la plateforme régionale de transport partagé.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${manrope.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}