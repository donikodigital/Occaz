// web-admin/src/app/login/page.tsx
'use client';

import React, { useId, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconKey, IconLock, IconMail, IconPhone } from '@tabler/icons-react';
import { Button, PasswordField, TextField } from '@/components/ui';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';
import type { AuthResult } from '@/types/auth.types';

type Mode = 'password' | 'phone-request' | 'phone-verify' | 'reset-request' | 'reset-confirm';

/**
 * Marque OCCAZ : un pin de localisation en dégradé bleu océan, avec
 * l'anneau ambre du repère d'origine conservé (ce n'est pas la couleur
 * qu'on retire — seul l'indigo/violet de marque l'est). `useId` évite
 * les doublons d'identifiant de dégradé quand le repère apparaît deux
 * fois sur la page (panneau desktop + en-tête mobile).
 */
function OccazMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  const gradientId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 26" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <defs>
        <linearGradient id={gradientId} x1="3" y1="1" x2="19" y2="23" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#1e9bd7" />
          <stop offset="55%" stopColor="#0b6ba8" />
          <stop offset="100%" stopColor="#083a63" />
        </linearGradient>
      </defs>
      <path
        d="M12 1.5C7.86 1.5 4.5 4.86 4.5 9c0 5.55 7.5 15.5 7.5 15.5S19.5 14.55 19.5 9c0-4.14-3.36-7.5-7.5-7.5z"
        fill={`url(#${gradientId})`}
      />
      <circle cx="12" cy="9.2" r="2.8" fill="#fff" />
      <circle cx="12" cy="9.2" r="2.8" fill="none" stroke="var(--color-accent)" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Motif de marque : un tracé de trajet reliant quelques repères, sur
 * fond dégradé bleu océan — ancré dans le sujet (une plateforme de
 * transport partagé), pas un dégradé générique de tableau de bord SaaS.
 */
function RouteMotif() {
  return (
    <svg viewBox="0 0 480 640" fill="none" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
      <path
        d="M-40 560 C 80 520, 120 460, 160 420 S 260 340, 300 300 S 360 200, 440 140 S 520 60, 560 20"
        stroke="#ffffff"
        strokeOpacity="0.2"
        strokeWidth="3"
        strokeDasharray="2 14"
        strokeLinecap="round"
      />
      <circle cx="160" cy="420" r="6" fill="var(--color-accent)" />
      <circle cx="300" cy="300" r="5" fill="var(--color-success)" fillOpacity="0.9" />
      <circle cx="440" cy="140" r="7" fill="var(--color-accent)" />
      <circle cx="160" cy="420" r="14" stroke="var(--color-accent)" strokeOpacity="0.4" strokeWidth="1.5" />
      <circle cx="440" cy="140" r="16" stroke="var(--color-accent)" strokeOpacity="0.4" strokeWidth="1.5" />
      {[
        [70, 180], [400, 460], [90, 340], [260, 90], [380, 560], [200, 550], [440, 320],
      ].map(([cx, cy], index) => (
        <circle key={index} cx={cx} cy={cy} r="2.5" fill="#ffffff" fillOpacity="0.35" />
      ))}
    </svg>
  );
}

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

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      {/* Halo décoratif discret derrière la carte, pour un fond qui n'est jamais plat. */}
      <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary-light/60 blur-3xl lg:right-[38%]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-primary-accent/20 blur-3xl lg:right-0" />

      {/* Panneau de marque — masqué sur mobile, où la place est trop restreinte pour être autre chose que du remplissage. */}
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-gradient-ocean lg:flex lg:flex-col lg:justify-between">
        <RouteMotif />
        <div className="relative z-10 px-12 pt-14">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
              <OccazMark size={26} />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-tight text-white">OCCAZ</p>
              <p className="text-xs font-medium text-white/70">Transport Partagé</p>
            </div>
          </div>
        </div>
        <div className="relative z-10 px-12 pb-16">
          <p className="max-w-xs text-2xl font-semibold leading-snug text-white">
            L&apos;envers du décor de chaque trajet et chaque envoi.
          </p>
          <p className="mt-3 max-w-xs text-sm text-white/70">
            Back-office Support &amp; Administration — utilisateurs, litiges, paiements et tarification, au même
            endroit.
          </p>
        </div>
      </div>

      {/* Panneau de connexion */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-light">
              <OccazMark size={26} />
            </div>
            <div>
              <p className="text-xl font-extrabold tracking-tight text-text-primary">OCCAZ</p>
              <p className="text-xs font-medium text-text-secondary">Transport Partagé</p>
            </div>
          </div>

          {/* Carte ombrée — jamais le formulaire posé nu sur le fond. */}
          <div className="rounded-3xl border border-border bg-surface p-7 shadow-xl shadow-primary-dark/10 sm:p-8">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold text-text-primary">
                {mode === 'password'
                  ? 'Connexion'
                  : mode === 'phone-request'
                    ? 'Connexion par téléphone'
                    : mode === 'phone-verify'
                      ? 'Vérification'
                      : mode === 'reset-request'
                        ? 'Mot de passe oublié'
                        : 'Nouveau mot de passe'}
              </h1>
              <p className="mt-1 text-sm text-text-secondary">
                {mode === 'password'
                  ? 'Accédez à votre espace Support ou Administration OCCAZ.'
                  : mode === 'phone-request'
                    ? 'Un code de vérification vous sera envoyé par SMS.'
                    : mode === 'phone-verify'
                      ? `Entrez le code reçu au ${phone}.`
                      : mode === 'reset-request'
                        ? 'Recevez un code par email pour réinitialiser votre mot de passe.'
                        : (resetMessage ?? `Entrez le code reçu à ${resetEmail} et votre nouveau mot de passe.`)}
              </p>
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
                />
                <PasswordField
                  label="Mot de passe"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                {!needsTwoFactor ? (
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setMode('reset-request');
                      setErrorMessage(undefined);
                    }}
                    className="-mt-3 text-sm text-text-secondary transition-colors hover:text-primary"
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
                  />
                ) : null}
                {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
                <Button type="submit" loading={isSubmitting} className="w-full py-3">
                  <IconLock size={16} />
                  Se connecter
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('phone-request');
                    setErrorMessage(undefined);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
                >
                  <IconPhone size={14} />
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
                />
                {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
                <Button type="submit" loading={isSubmitting} className="w-full py-3">
                  <IconPhone size={16} />
                  Recevoir un code
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('password');
                    setErrorMessage(undefined);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
                >
                  <IconMail size={14} />
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
                />
                {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
                <Button type="submit" loading={isSubmitting} className="w-full py-3">
                  Vérifier
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('phone-request');
                    setErrorMessage(undefined);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
                >
                  <IconArrowLeft size={14} />
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
                />
                {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
                <Button type="submit" loading={isSubmitting} className="w-full py-3">
                  <IconKey size={16} />
                  Recevoir un code
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('password');
                    setErrorMessage(undefined);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
                >
                  <IconArrowLeft size={14} />
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
                />
                <PasswordField
                  label="Nouveau mot de passe"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
                {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
                <Button type="submit" loading={isSubmitting} className="w-full py-3">
                  Réinitialiser le mot de passe
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('reset-request');
                    setErrorMessage(undefined);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-primary"
                >
                  <IconArrowLeft size={14} />
                  Redemander un code
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}