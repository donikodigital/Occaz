// web-admin/src/components/cookies/CookieBanner.tsx
//
// Bandeau de consentement cookies — visible avant toute connexion (monté
// dans Providers.tsx, qui enveloppe tout le site, y compris /login). Le
// choix est retenu localement (localStorage) pour ne pas redemander à
// chaque page, et envoyé à /cookie-consent (route publique) pour garder
// une trace de ce qui a été accepté et quand — voir CookieConsentService,
// backend.

'use client';

import React, { useEffect, useState } from 'react';
import { IconCookie } from '@tabler/icons-react';
import { Button } from '@/components/ui';
import { ToggleRow } from '@/components/admin/AdminUi';
import { cookieConsentApi } from '@/services/api/promotions.api';

/**
 * À incrémenter si le texte de la politique change substantiellement —
 * chaque enregistrement de consentement garde la version affichée à ce
 * moment-là (voir CookieConsent.policyVersion, schema.prisma).
 */
const POLICY_VERSION = '2026-09-23';
const STORAGE_KEY = 'occaz_cookie_consent';

interface StoredConsent {
  choice: 'ACCEPT_ALL' | 'REJECT_ALL' | 'CUSTOM';
  policyVersion: string;
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [analytics, setAnalytics] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setVisible(true);
        return;
      }
      const parsed = JSON.parse(stored) as StoredConsent;
      if (parsed.policyVersion !== POLICY_VERSION) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  async function record(choice: StoredConsent['choice'], categories?: Record<string, boolean>) {
    setSending(true);
    try {
      await cookieConsentApi.record({ choice, policyVersion: POLICY_VERSION, categories });
    } catch {
      // Le choix reste appliqué localement même si l'enregistrement échoue
      // (hors ligne, etc.) — on ne bloque jamais l'utilisateur pour ça.
    } finally {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ choice, policyVersion: POLICY_VERSION }));
      setSending(false);
      setVisible(false);
    }
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-3 sm:p-4">
      <div className="mx-auto max-w-3xl rounded-3xl border border-border bg-surface p-4 shadow-2xl sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
            <IconCookie size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary">Cookies</p>
            <p className="mt-1 text-xs text-text-secondary">
              Nous utilisons des cookies techniques nécessaires au fonctionnement du site, et, avec votre accord, des
              cookies de mesure d'audience.
            </p>
          </div>
        </div>

        {customizing ? (
          <div className="mt-4 space-y-2">
            <ToggleRow checked={true} onChange={() => undefined} label="Cookies techniques" description="Toujours actifs — nécessaires au fonctionnement du site." />
            <ToggleRow checked={analytics} onChange={setAnalytics} label="Mesure d'audience" description="Nous aide à comprendre l'usage du site." />
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {!customizing ? (
            <button
              type="button"
              onClick={() => setCustomizing(true)}
              className="rounded-xl px-3 py-2.5 text-sm font-semibold text-text-secondary transition hover:text-text-primary"
            >
              Personnaliser
            </button>
          ) : null}
          <Button type="button" variant="secondary" onClick={() => record('REJECT_ALL')} loading={sending}>
            Tout refuser
          </Button>
          <Button
            type="button"
            onClick={() =>
              customizing ? record('CUSTOM', { analytics, marketing: false }) : record('ACCEPT_ALL')
            }
            loading={sending}
          >
            {customizing ? 'Enregistrer mes choix' : 'Tout accepter'}
          </Button>
        </div>
      </div>
    </div>
  );
}