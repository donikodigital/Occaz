// web-admin/src/app/login/page.tsx
// [02/10/2026] v2 — Refonte visuelle : même habillage Ocean que l'app Client /
// Conducteur (ciel en fond sous un voile clair, illustration à étincelles avec
// le vrai logo pin, titre bleu profond, carte ombrée). Les anciens logos
// dessinés à la main (OccazMark, RouteMotif) sont retirés au profit du logo
// de l'app. Logique d'authentification inchangée.
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconArrowLeft,
  IconKey,
  IconLock,
  IconMail,
  IconPhone,
  IconShieldCheck,
} from '@tabler/icons-react';
import { Button, PasswordField, TextField } from '@/components/ui';
import { AuthIllustration } from '@/components/auth/AuthIllustration';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';
import type { AuthResult } from '@/types/auth.types';

type Mode = 'password' | 'phone-request' | 'phone-verify' | 'reset-request' | 'reset-confirm';

/** Champs de la carte : fond bleu très clair et bord océan, comme les champs de l'app. */
const FIELD_CLASS = 'rounded-xl! border-primary-accent! bg-primary-light/40! py-3!';

/** Bouton principal : même dégradé que l'app, coins plus arrondis. */
const SUBMIT_CLASS = 'w-full rounded-xl! py-3.5! text-base! shadow-lg! shadow-primary-dark/25!';

/** Lien secondaire sous le bouton principal. */
const LINK_CLASS =
  'flex w-full items-center justify-center gap-1.5 text-sm font-medium text-primary transition-colors hover:text-primary-dark';

/**
 * Email + mot de passe en mode principal (public professionnel), avec
 * un repli "Se connecter par téléphone" — nécessaire pour un premier
 * accès SuperAdmin : la 2FA est obligatoire pour ce rôle (section 3.1)
 * mais /auth/2fa/setup exige déjà une session active, et la connexion
 * par mot de passe reste bloquée tant qu'elle n'est pas configurée.
 * Seule la connexion par téléphone (sans contrainte 2FA côté backend,
 * vérifié dans auth.service.ts) permet d'amorcer ce premier réglage.
 */
export default function LoginPage() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);

  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);
  const [phone, setPhone] = useState('+224');
  const [otpCode, setOtpCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetMessage, setResetMessage] = useState<string | undefined>();
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  function handleAuthSuccess(result: AuthResult) {
    setSession(result);
    if (result.user.accountType === 'SUPERADMIN' && !result.user.isTwoFactorEnabled) {
      router.replace('/setup-2fa');
      return;
    }
    router.replace('/dashboard');
  }

  async function handlePasswordSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      const result = await authApi.loginWithPassword({
        email,
        password,
        twoFactorCode: needsTwoFactor ? twoFactorCode : undefined,
      });
      handleAuthSuccess(result);
    } catch (error) {
      if (error instanceof ApiError && /2FA/i.test(error.message)) {
        setNeedsTwoFactor(true);
      }
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestOtp(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await authApi.requestOtp({ phone });
      setMode('phone-verify');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      const result = await authApi.verifyOtp({ phone, code: otpCode });
      handleAuthSuccess(result);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRequestReset(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      const { message } = await authApi.requestPasswordReset(resetEmail);
      setResetMessage(message);
      setMode('reset-confirm');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirmReset(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await authApi.confirmPasswordReset({ email: resetEmail, code: resetCode, newPassword });
      setMode('password');
      setPassword('');
      setResetMessage(undefined);
      setErrorMessage(undefined);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  const title =
    mode === 'password'
      ? 'Connexion'
      : mode === 'phone-request'
        ? 'Connexion par téléphone'
        : mode === 'phone-verify'
          ? 'Vérification'
          : mode === 'reset-request'
            ? 'Mot de passe oublié'
            : 'Nouveau mot de passe';

  const subtitle =
    mode === 'password'
      ? 'Accédez à votre espace Support ou Administration.'
      : mode === 'phone-request'
        ? 'Un code de vérification vous sera envoyé par SMS.'
        : mode === 'phone-verify'
          ? `Entrez le code reçu au ${phone}.`
          : mode === 'reset-request'
            ? 'Recevez un code par email pour réinitialiser votre mot de passe.'
            : (resetMessage ?? `Entrez le code reçu à ${resetEmail} et votre nouveau mot de passe.`);

  return (
    <div
      className="relative min-h-screen bg-cover bg-center"
      style={{ backgroundImage: "url('/brand/onboarding-sky.jpg')" }}
    >
      {/* Voile clair entre la photo de ciel et le contenu : le ciel reste visible, le texte reste lisible. */}
      <div className="pointer-events-none absolute inset-0 bg-white/75" />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center px-5 py-10">
        {/* Marque : logo pin sur badge, nom de l'application et puce de rôle. */}
        <header className="animate-in mb-6 flex flex-col items-center text-center">
          <AuthIllustration size={132} />
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-primary-dark">Occa&apos;Z</h2>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-primary-accent bg-white/80 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
            <IconShieldCheck size={14} />
            Espace Support &amp; Administration
          </span>
        </header>

        {/* Carte ombrée — jamais le formulaire posé nu sur le fond. */}
        <div className="animate-in w-full rounded-3xl border border-primary-accent/70 bg-surface/95 p-7 shadow-2xl shadow-primary-dark/15 backdrop-blur sm:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-primary-dark">{title}</h1>
            <p className="mt-1.5 text-sm leading-relaxed text-text-secondary">{subtitle}</p>
          </div>

          {mode === 'password' ? (
            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              <TextField
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoFocus
                required
                className={FIELD_CLASS}
              />
              <PasswordField
                label="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={FIELD_CLASS}
              />
              {!needsTwoFactor ? (
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setMode('reset-request');
                    setErrorMessage(undefined);
                  }}
                  className="-mt-2 text-sm font-medium text-text-secondary transition-colors hover:text-primary"
                >
                  Mot de passe oublié ?
                </button>
              ) : null}
              {needsTwoFactor ? (
                <TextField
                  label="Code de double authentification"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="123456"
                  maxLength={6}
                  required
                  className={FIELD_CLASS}
                />
              ) : null}
              {errorMessage ? (
                <p className="rounded-xl bg-danger-light px-3.5 py-2.5 text-sm text-danger-dark">{errorMessage}</p>
              ) : null}
              <Button type="submit" loading={isSubmitting} className={SUBMIT_CLASS}>
                <IconLock size={18} />
                Se connecter
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('phone-request');
                  setErrorMessage(undefined);
                }}
                className={LINK_CLASS}
              >
                <IconPhone size={15} />
                Se connecter par téléphone
              </button>
            </form>
          ) : null}

          {mode === 'phone-request' ? (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <TextField
                label="Numéro de téléphone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+224620000000"
                autoFocus
                required
                className={FIELD_CLASS}
              />
              {errorMessage ? (
                <p className="rounded-xl bg-danger-light px-3.5 py-2.5 text-sm text-danger-dark">{errorMessage}</p>
              ) : null}
              <Button type="submit" loading={isSubmitting} className={SUBMIT_CLASS}>
                <IconPhone size={18} />
                Recevoir un code
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('password');
                  setErrorMessage(undefined);
                }}
                className={LINK_CLASS}
              >
                <IconMail size={15} />
                Se connecter par email
              </button>
            </form>
          ) : null}

          {mode === 'phone-verify' ? (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <TextField
                label="Code reçu par SMS"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                autoFocus
                required
                className={FIELD_CLASS}
              />
              {errorMessage ? (
                <p className="rounded-xl bg-danger-light px-3.5 py-2.5 text-sm text-danger-dark">{errorMessage}</p>
              ) : null}
              <Button type="submit" loading={isSubmitting} className={SUBMIT_CLASS}>
                Vérifier
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('phone-request');
                  setErrorMessage(undefined);
                }}
                className={LINK_CLASS}
              >
                <IconArrowLeft size={15} />
                Changer de numéro
              </button>
            </form>
          ) : null}

          {mode === 'reset-request' ? (
            <form onSubmit={handleRequestReset} className="space-y-5">
              <TextField
                label="Email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="vous@exemple.com"
                autoFocus
                required
                className={FIELD_CLASS}
              />
              {errorMessage ? (
                <p className="rounded-xl bg-danger-light px-3.5 py-2.5 text-sm text-danger-dark">{errorMessage}</p>
              ) : null}
              <Button type="submit" loading={isSubmitting} className={SUBMIT_CLASS}>
                <IconKey size={18} />
                Recevoir un code
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('password');
                  setErrorMessage(undefined);
                }}
                className={LINK_CLASS}
              >
                <IconArrowLeft size={15} />
                Retour à la connexion
              </button>
            </form>
          ) : null}

          {mode === 'reset-confirm' ? (
            <form onSubmit={handleConfirmReset} className="space-y-5">
              <TextField
                label="Code reçu par email"
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                autoFocus
                required
                className={FIELD_CLASS}
              />
              <PasswordField
                label="Nouveau mot de passe"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className={FIELD_CLASS}
              />
              {errorMessage ? (
                <p className="rounded-xl bg-danger-light px-3.5 py-2.5 text-sm text-danger-dark">{errorMessage}</p>
              ) : null}
              <Button type="submit" loading={isSubmitting} className={SUBMIT_CLASS}>
                Réinitialiser le mot de passe
              </Button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset-request');
                  setErrorMessage(undefined);
                }}
                className={LINK_CLASS}
              >
                <IconArrowLeft size={15} />
                Redemander un code
              </button>
            </form>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-text-muted">© 2026 Occa&apos;Z · occaz.sarl</p>
      </main>
    </div>
  );
}