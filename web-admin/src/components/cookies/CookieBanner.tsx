// web-admin/src/components/cookies/CookieBanner.tsx
//
// Bandeau de consentement cookies — visible avant toute connexion (monté
// dans Providers.tsx, qui enveloppe tout le site, y compris /login). Le
// choix est retenu localement (localStorage) pour ne pas redemander à
// chaque page, et envoyé à /cookie-consent (route publique) pour garder
// une trace de ce qui a été accepté et quand — voir CookieConsentService,
// backend.
// [30/10/2026] v3 — Les trois boutons d'action restent TOUJOURS sur une seule ligne (trois colonnes égales sur téléphone, alignés à droite
// dès l'écran moyen) ; « Tout refuser » et « Tout accepter » ont le même poids. Le bandeau se ferme tout de suite (l'enregistrement part en
// arrière-plan), la mesure d'audience est décochée par défaut (consentement actif), accessibilité (dialogue nommé, bascule étiquetée) et
// marge de sécurité en bas des téléphones à encoche.
// [20/10/2026] Lien vers la politique de confidentialité (/confidentialite) ; version de la politique passée à 2026-10-20 (texte définitif).

'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconCookie } from '@tabler/icons-react';
import { Button } from '@/components/ui';
import { ToggleRow } from '@/components/admin/AdminUi';
import { cookieConsentApi } from '@/services/api/promotions.api';

/**
 * À incrémenter si le texte de la politique change substantiellement —
 * chaque enregistrement de consentement garde la version affichée à ce
 * moment-là (voir CookieConsent.policyVersion, schema.prisma).
 */
const POLICY_VERSION = '2026-10-20';
const STORAGE_KEY = 'occaz_cookie_consent';

type Choice = 'ACCEPT_ALL' | 'REJECT_ALL' | 'CUSTOM';

interface StoredConsent {
  choice: Choice;
  policyVersion: string;
}

/** Lit le choix gardé sur cet appareil ; false = il faut (re)demander. */
function hasValidConsent(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    return (JSON.parse(stored) as StoredConsent).policyVersion === POLICY_VERSION;
  } catch {
    return false;
  }
}

// Même gabarit pour les trois boutons : pleine colonne, une seule ligne, texte jamais coupé en deux.
const ACTION = 'w-full whitespace-nowrap px-2! text-[13px] sm:w-auto sm:px-5! sm:text-sm';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  // Consentement actif : la mesure d'audience n'est jamais cochée d'office.
  const [analytics, setAnalytics] = useState(false);

  useEffect(() => {
    if (!hasValidConsent()) setVisible(true);
  }, []);

  /** Ferme tout de suite ; la trace côté serveur part en arrière-plan (hors ligne, etc. : le choix reste appliqué ici). */
  function record(choice: Choice, categories?: Record<string, boolean>) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, policyVersion: POLICY_VERSION } satisfies StoredConsent));
    } catch {
      // stockage indisponible (navigation privée stricte…) : le bandeau reviendra, sans bloquer personne
    }
    setVisible(false);
    void cookieConsentApi.record({ choice, policyVersion: POLICY_VERSION, categories }).catch(() => undefined);
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-4 sm:pb-4">
      <div
        role="dialog"
        aria-labelledby="cookie-title"
        aria-describedby="cookie-text"
        className="mx-auto max-w-3xl rounded-3xl border border-border bg-surface p-4 shadow-2xl sm:p-5"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <IconCookie size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p id="cookie-title" className="text-sm font-semibold text-text-primary">
              Cookies
            </p>
            <p id="cookie-text" className="mt-1 text-xs leading-relaxed text-text-secondary">
              Nous utilisons des cookies techniques nécessaires au fonctionnement du site, et, avec votre accord, des
              cookies de mesure d&apos;audience.{' '}
              <Link href="/confidentialite" className="font-semibold text-primary underline-offset-2 hover:underline">
                En savoir plus
              </Link>
            </p>
          </div>
        </div>

        {customizing ? (
          <div className="mt-4 space-y-2">
            <ToggleRow checked={true} onChange={() => undefined} label="Cookies techniques" description="Toujours actifs — nécessaires au fonctionnement du site." />
            <ToggleRow checked={analytics} onChange={setAnalytics} label="Mesure d'audience" description="Nous aide à comprendre l'usage du site. Désactivée tant que vous ne l'autorisez pas." />
          </div>
        ) : null}

        {/* Une seule ligne, quel que soit l'écran : 3 colonnes égales sur téléphone, boutons alignés à droite au-delà. */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:flex sm:justify-end">
          <Button type="button" variant="ghost" className={`${ACTION} border border-border`} onClick={() => setCustomizing((open) => !open)}>
            {customizing ? 'Retour' : 'Personnaliser'}
          </Button>
          <Button type="button" variant="secondary" className={ACTION} onClick={() => record('REJECT_ALL')}>
            Tout refuser
          </Button>
          {customizing ? (
            <Button type="button" className={ACTION} onClick={() => record('CUSTOM', { analytics, marketing: false })}>
              Enregistrer
            </Button>
          ) : (
            <Button type="button" className={ACTION} onClick={() => record('ACCEPT_ALL')}>
              Tout accepter
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}