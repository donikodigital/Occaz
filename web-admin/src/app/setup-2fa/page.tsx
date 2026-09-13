// web-admin/src/app/setup-2fa/page.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'qrcode';
import { Button, Card, TextField } from '@/components/ui';
import { authApi } from '@/services/api/auth.api';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';

/**
 * N'apparaît que pour un SuperAdmin dont la 2FA n'est pas encore
 * activée (voir login/page.tsx) — obligatoire avant de pouvoir se
 * reconnecter par mot de passe (section 3.1). La connexion par
 * téléphone qui a amené ici reste disponible en attendant.
 */
export default function SetupTwoFactorPage() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const hasRequestedSetup = useRef(false);

  useEffect(() => {
    if (hasRequestedSetup.current) return;
    hasRequestedSetup.current = true;

    authApi.setupTwoFactor().then(async (result) => {
      setSecret(result.secret);
      const dataUrl = await QRCode.toDataURL(result.otpAuthUri, { margin: 1, width: 220 });
      setQrDataUrl(dataUrl);
    });
  }, []);

  async function handleConfirm(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSubmitting(true);
    try {
      await authApi.enableTwoFactor(code);
      router.replace('/dashboard');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Code invalide.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xl font-bold text-primary">Sécurisez votre compte</p>
          <p className="text-sm text-text-secondary">
            La double authentification est obligatoire pour {user?.email ?? 'ce compte'}.
          </p>
        </div>

        <Card className="space-y-5">
          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">
              1. Scannez ce code avec une application d&apos;authentification (Google Authenticator, Authy...)
            </p>
            <div className="flex justify-center rounded-lg border border-border bg-surface-muted p-4">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Code QR de configuration 2FA" width={220} height={220} />
              ) : (
                <div className="flex h-[220px] w-[220px] items-center justify-center text-sm text-text-muted">
                  Génération…
                </div>
              )}
            </div>
            {secret ? (
              <p className="mt-2 break-all text-center text-xs text-text-muted">Ou saisissez ce code : {secret}</p>
            ) : null}
          </div>

          <form onSubmit={handleConfirm} className="space-y-4">
            <TextField
              label="2. Entrez le code à 6 chiffres généré"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="123456"
              maxLength={6}
              required
            />
            {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
            <Button type="submit" loading={isSubmitting} disabled={!secret} className="w-full">
              Activer la double authentification
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
