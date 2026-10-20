// web-admin/src/app/definir-mot-de-passe/page.tsx
//
// [20/10/2026] v1 — Page publique du lien reçu par e-mail après la création d'un compte d'équipe : /definir-mot-de-passe?token=…
// La personne y choisit son mot de passe (une seule fois), puis se connecte avec son adresse e-mail.
//  • Le jeton est lu côté navigateur puis retiré de la barre d'adresse (historique, copier-coller, captures d'écran).
//  • Lien inconnu, expiré ou déjà utilisé : message unique, avec la marche à suivre (demander un nouvel envoi au SuperAdmin).
//  • Règles du mot de passe (10 caractères, une lettre, un chiffre) vérifiées ici pour guider la saisie, et par le serveur.
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconCheck, IconCircle, IconCircleCheck, IconLock, IconLoader2, IconShieldCheck } from '@tabler/icons-react';
import { Button, PasswordField } from '@/components/ui';
import { AuthIllustration } from '@/components/auth/AuthIllustration';
import { staffAccountsApi } from '@/services/api/staffAccounts.api';
import { ApiError } from '@/services/api/ApiError';
import type { StaffInvitationPreview } from '@/types/staff-accounts.types';

const FIELD_CLASS = 'rounded-xl! border-primary-accent! bg-primary-light/40! py-3!';
const SUBMIT_CLASS = 'w-full rounded-xl! py-3.5! text-base! shadow-lg! shadow-primary-dark/25!';

type Phase = 'checking' | 'invalid' | 'form' | 'done';

function Rule({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${ok ? 'text-success-dark' : 'text-text-muted'}`}>
      {ok ? <IconCheck size={14} /> : <IconCircle size={14} />}
      {children}
    </li>
  );
}

export default function SetPasswordPage() {
  const [phase, setPhase] = useState<Phase>('checking');
  const [token, setToken] = useState('');
  const [preview, setPreview] = useState<StaffInvitationPreview | null>(null);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [invalidMessage, setInvalidMessage] = useState<string | undefined>();

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get('token')?.trim() ?? '';
    // Le jeton quitte la barre d'adresse : il reste uniquement en mémoire, le temps de la saisie.
    window.history.replaceState(null, '', window.location.pathname);
    if (!value) {
      setPhase('invalid');
      return;
    }
    setToken(value);
    staffAccountsApi
      .inspectInvitation(value)
      .then((result) => {
        setPreview(result);
        setPhase('form');
      })
      .catch((error: unknown) => {
        setInvalidMessage(error instanceof ApiError && error.statusCode === 400 ? error.message : undefined);
        setPhase('invalid');
      });
  }, []);

  const hasLength = password.length >= 10;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /\d/.test(password);
  const matches = password.length > 0 && password === confirmation;
  const canSubmit = hasLength && hasLetter && hasDigit && matches && password.length <= 72;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await staffAccountsApi.acceptInvitation(token, password);
      setPassword('');
      setConfirmation('');
      setPhase('done');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen bg-cover bg-center" style={{ backgroundImage: "url('/brand/onboarding-sky.jpg')" }}>
      <div className="pointer-events-none absolute inset-0 bg-white/75" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10">
        <header className="animate-in mb-6 flex flex-col items-center text-center">
          <AuthIllustration size={112} />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-primary-dark">Occa&apos;Z</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary-accent bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
            <IconShieldCheck size={14} />
            Espace Support &amp; Administration
          </span>
        </header>

        <div className="animate-in w-full rounded-3xl border border-primary-accent/70 bg-surface/95 p-7 shadow-2xl shadow-primary-dark/15 backdrop-blur sm:p-8">
          {phase === 'checking' ? (
            <div className="flex flex-col items-center gap-3 py-6 text-sm text-text-secondary">
              <IconLoader2 size={26} className="animate-spin text-primary" />
              Vérification de votre lien…
            </div>
          ) : null}

          {phase === 'invalid' ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-light text-accent-dark">
                <IconAlertTriangle size={26} />
              </span>
              <h1 className="text-2xl font-bold text-primary-dark">Lien non valide</h1>
              <p className="text-sm leading-relaxed text-text-secondary">
                {invalidMessage ?? 'Ce lien est incomplet, déjà utilisé ou expiré.'} Si vous avez déjà choisi votre mot de passe, connectez-vous
                directement.
              </p>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-ocean py-3.5 text-base font-semibold text-on-primary shadow-lg shadow-primary-dark/25"
              >
                <IconLock size={18} />
                Aller à la connexion
              </Link>
            </div>
          ) : null}

          {phase === 'form' && preview ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-primary-dark">
                  Bienvenue{preview.firstName ? `, ${preview.firstName}` : ''}
                </h1>
                <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                  Choisissez le mot de passe de votre compte <span className="font-semibold text-text-primary">{preview.email}</span>. Vous
                  vous connecterez avec cette adresse e-mail.
                </p>
              </div>

              <PasswordField
                label="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                autoFocus
                required
                className={FIELD_CLASS}
              />
              <PasswordField
                label="Confirmer le mot de passe"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
                required
                className={FIELD_CLASS}
              />

              <ul className="space-y-1.5 rounded-2xl bg-primary-light/50 px-4 py-3">
                <Rule ok={hasLength}>10 caractères au minimum</Rule>
                <Rule ok={hasLetter}>Au moins une lettre</Rule>
                <Rule ok={hasDigit}>Au moins un chiffre</Rule>
                <Rule ok={matches}>Les deux saisies sont identiques</Rule>
              </ul>

              {errorMessage ? (
                <p className="rounded-xl bg-danger-light px-3.5 py-2.5 text-sm text-danger-dark">{errorMessage}</p>
              ) : null}
              <Button type="submit" loading={isSubmitting} disabled={!canSubmit} className={SUBMIT_CLASS}>
                <IconLock size={18} />
                Enregistrer mon mot de passe
              </Button>
            </form>
          ) : null}

          {phase === 'done' ? (
            <div className="space-y-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-success-light text-success-dark">
                <IconCircleCheck size={28} />
              </span>
              <h1 className="text-2xl font-bold text-primary-dark">Mot de passe enregistré</h1>
              <p className="text-sm leading-relaxed text-text-secondary">
                Votre compte est prêt. Connectez-vous avec <span className="font-semibold text-text-primary">{preview?.email}</span> et votre
                nouveau mot de passe.
              </p>
              <Link
                href="/login"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-ocean py-3.5 text-base font-semibold text-on-primary shadow-lg shadow-primary-dark/25"
              >
                <IconLock size={18} />
                Me connecter
              </Link>
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">© 2026 Occa&apos;Z · occaz.sarl</p>
      </main>
    </div>
  );
}
