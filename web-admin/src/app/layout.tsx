// web-admin/src/app/layout.tsx
// [23/09/2026] v+ — Restauré : ce fichier avait été écrasé par erreur avec
// le contenu de app/(app)/layout.tsx (commit f78d317), ce qui supprimait
// <html>/<body>, les polices, les métadonnées et Providers — cassant
// entre autres la page de connexion, hors du groupe (app). Le vrai layout
// du groupe authentifié reste dans app/(app)/layout.tsx, inchangé.
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from '@/components/layout/Providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Occaz Go — Transport Partagé',
  description: 'Administration de la plateforme régionale de transport partagé.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}