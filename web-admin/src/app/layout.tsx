// web-admin/src/app/layout.tsx
import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { Providers } from '@/components/layout/Providers';
import './globals.css';

const manrope = Manrope({ subsets: ['latin'], variable: '--font-manrope' });

export const metadata: Metadata = {
  title: 'Back-office — Transport Partagé',
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