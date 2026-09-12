// web-admin/src/app/login/page.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconArrowLeft, IconLock, IconMail, IconPhone, IconRoute2 } from '@tabler/icons-react';
import { Button, PasswordField, TextField } from '@/components/ui';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';
import type { AuthResult } from '@/types/auth.types';

type Mode = 'password' | 'phone-request' | 'phone-verify';

/**
 * Motif de marque : un tracé de trajet reliant quelques repères, sur
 * fond indigo — ancré dans le sujet (une plateforme de transport
 * partagé), pas un dégradé générique de tableau de bord SaaS.
 */
function RouteMotif() {
  return (
    <svg viewBox="0 0 480 640" fill="none" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice">
      <path
        d="M-40 560 C 80 520, 120 460, 160 420 S 260 340, 300 300 S 360 200, 440 140 S 520 60, 560 20"
        stroke="var(--color-primary-light)"
        strokeOpacity="0.25"
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
        <circle key={index} cx={cx} cy={cy} r="2.5" fill="var(--color-primary-light)" fillOpacity="0.4" />
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

  return (
    <div className="flex min-h-screen bg-background">
      {/* Panneau de marque — masqué sur mobile, où la place est trop restreinte pour être autre chose que du remplissage. */}
      <div className="relative hidden w-[42%] shrink-0 overflow-hidden bg-primary lg:flex lg:flex-col lg:justify-between">
        <RouteMotif />
        <div className="relative z-10 px-12 pt-14">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
              <IconRoute2 size={20} className="text-white" />
            </div>
            <p className="text-lg font-bold text-white">Transport Partagé</p>
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
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-9 lg:hidden">
            <div className="mb-2 flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light">
                <IconRoute2 size={20} className="text-primary" />
              </div>
              <p className="text-lg font-bold text-text-primary">Transport Partagé</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-semibold text-text-primary">
              {mode === 'password' ? 'Connexion' : mode === 'phone-request' ? 'Connexion par téléphone' : 'Vérification'}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {mode === 'password'
                ? 'Accédez à votre espace Support ou Administration.'
                : mode === 'phone-request'
                  ? 'Un code de vérification vous sera envoyé par SMS.'
                  : `Entrez le code reçu au ${phone}.`}
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
        </div>
      </div>
    </div>
  );
}
