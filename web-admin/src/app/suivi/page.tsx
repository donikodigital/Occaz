// web-admin/src/app/suivi/page.tsx
//
// [20/10/2026] v1 — https://occaz.sarl/suivi : saisie d'un numéro de suivi (OCZ…) pour ouvrir /suivi/<numéro>. Sert quand on a le numéro
// (étiquette du colis, SMS) mais pas le lien de l'e-mail. Le numéro est nettoyé comme le fait le serveur : espaces et tirets ignorés.
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconPackage, IconSearch } from '@tabler/icons-react';
import { TrackingShell } from '@/components/tracking/TrackingShell';

const PATTERN = /^OCZ[0-9A-F]{10}$/;

/** « ocz 7f3a-91c2 b0 » → « OCZ7F3A91C2B0 » ; « OCZ7F3A91C2B0-02 » (numéro d'un colis) → numéro de l'envoi. */
function clean(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, '').replace(/-\d{1,3}$/, '').replace(/[^A-Z0-9]/g, '');
}

export default function TrackingSearchPage() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const number = clean(value);
    if (!PATTERN.test(number)) {
      setError('Ce numéro n’est pas valide. Il commence par OCZ, suivi de 10 caractères (lettres A à F et chiffres).');
      return;
    }
    setError(null);
    router.push(`/suivi/${number}`);
  }

  return (
    <TrackingShell title="Suivre mon colis" subtitle="Entrez le numéro de suivi reçu par e-mail ou imprimé sur l’étiquette. Aucun compte n’est nécessaire.">
      <form onSubmit={submit} className="rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/10">
        <label htmlFor="tracking-number" className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
          <IconPackage size={16} aria-hidden />
          Numéro de suivi
        </label>
        <input
          id="tracking-number"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="OCZ7F3A91C2B0"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          className="mt-3 w-full rounded-2xl border border-border bg-background px-4 py-3.5 text-center text-lg font-semibold uppercase tracking-widest text-text-primary outline-none transition focus:border-primary focus:ring-2 focus:ring-primary-accent"
        />
        {error ? (
          <p role="alert" className="mt-3 rounded-xl bg-danger-light px-3 py-2 text-sm text-danger-dark">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-base font-semibold text-on-primary shadow-md shadow-primary-dark/20 transition hover:bg-primary-dark"
        >
          <IconSearch size={20} aria-hidden />
          Suivre mon colis
        </button>
      </form>
    </TrackingShell>
  );
}
