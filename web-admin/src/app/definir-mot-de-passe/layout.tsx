// web-admin/src/app/definir-mot-de-passe/layout.tsx
//
// [20/10/2026] v1 — Page publique du lien « Choisir mon mot de passe » reçu par e-mail par un nouveau compte d'équipe (voir page.tsx).
// Le jeton est dans l'adresse : la page n'est pas indexée et n'envoie aucun « referrer » vers d'autres sites.
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Choisir mon mot de passe — Occa'Z",
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function SetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
