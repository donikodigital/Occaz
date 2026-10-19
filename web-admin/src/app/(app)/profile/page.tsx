// web-admin/src/app/(app)/profile/page.tsx
// [19/10/2026] v1 — « Mon profil » : informations du compte connecté et changement de numéro de téléphone.
// Pour l'équipe (Support, SuperAdmin), aucun SMS n'est envoyé : un code à 6 chiffres part par e-mail à l'adresse du compte, et le nouveau
// numéro n'est adopté qu'après sa saisie. Deux étapes : 1. nouveau numéro  2. code reçu par e-mail.
'use client';

import React, { useState } from 'react';
import { IconDeviceMobile, IconMail, IconShieldCheck, IconUserCircle } from '@tabler/icons-react';
import { Button, TextField } from '@/components/ui';
import { FormError, Notice, PageHero, SavedNotice } from '@/components/admin/AdminUi';
import { useConfirmPhoneChange, useRequestPhoneChange } from '@/hooks/usePhoneChange';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';

function errorText(error: unknown): string | undefined {
  if (!error) return undefined;
  return error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessaie.';
}

/** Garde le « + » de tête et les chiffres : « +224 620 00 00 00 » → « +224620000000 ». */
function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '');
  return trimmed.startsWith('+') || trimmed.startsWith('00') ? `+${digits.replace(/^00/, '')}` : digits ? `+${digits}` : '';
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface-muted px-4 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-text-secondary">{label}</p>
        <p className="truncate text-sm font-semibold text-text-primary">{value}</p>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const user = useAuthStore((state) => state.user);
  const requestChange = useRequestPhoneChange();
  const confirmChange = useConfirmPhoneChange();

  const [newPhone, setNewPhone] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const normalized = normalizePhone(newPhone);
  const phoneValid = /^\+\d{8,15}$/.test(normalized) && normalized !== user?.phone;
  const codeValid = /^\d{6}$/.test(code);
  const hasEmail = !!user?.email;

  function sendCode() {
    setSaved(null);
    requestChange.mutate(normalized, {
      onSuccess: (result) => {
        setSentTo(result.destination);
        setCode('');
      },
    });
  }

  function confirm() {
    confirmChange.mutate(
      { newPhone: normalized, code },
      {
        onSuccess: () => {
          setSaved(`Ton numéro est maintenant ${normalized}.`);
          setSentTo(null);
          setNewPhone('');
          setCode('');
        },
      },
    );
  }

  function backToNumber() {
    setSentTo(null);
    setCode('');
    confirmChange.reset();
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHero
        eyebrow="Mon compte"
        title="Mon profil"
        description="Les informations de ton compte et le changement de ton numéro de téléphone, confirmé par un code reçu par e-mail."
      />

      {saved ? <SavedNotice>{saved}</SavedNotice> : null}

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/5 sm:p-6">
        <h2 className="text-base font-bold text-text-primary">Mon compte</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <InfoRow icon={<IconUserCircle size={18} />} label="Rôle" value={user ? ACCOUNT_TYPE_LABELS[user.accountType] : '—'} />
          <InfoRow icon={<IconMail size={18} />} label="Adresse e-mail" value={user?.email ?? 'Non renseignée'} />
          <InfoRow icon={<IconDeviceMobile size={18} />} label="Numéro de téléphone" value={user?.phone ?? '—'} />
          <InfoRow
            icon={<IconShieldCheck size={18} />}
            label="Double authentification"
            value={user?.isTwoFactorEnabled ? 'Activée' : 'Non activée'}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/5 sm:p-6">
        <h2 className="text-base font-bold text-text-primary">Changer mon numéro de téléphone</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Aucun SMS n&apos;est envoyé : un code à 6 chiffres part par e-mail à l&apos;adresse de ton compte.
        </p>

        <div className="mt-4 space-y-4">
          {!hasEmail ? (
            <Notice>
              Ton compte n&apos;a pas d&apos;adresse e-mail : le code ne peut pas t&apos;être envoyé. Demande à un SuperAdmin d&apos;en ajouter une.
            </Notice>
          ) : sentTo ? (
            <>
              <Notice>
                Un code à 6 chiffres vient d&apos;être envoyé à {sentTo}. Il est valable quelques minutes et ne sert que pour le numéro{' '}
                {normalized}.
              </Notice>
              <TextField
                label="Code reçu par e-mail"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              />
              <button
                type="button"
                disabled={requestChange.isPending}
                onClick={sendCode}
                className="text-xs font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {requestChange.isPending ? 'Envoi…' : 'Renvoyer le code'}
              </button>
              <FormError message={errorText(confirmChange.error) ?? errorText(requestChange.error)} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="ghost" onClick={backToNumber}>
                  Modifier le numéro
                </Button>
                <Button loading={confirmChange.isPending} disabled={!codeValid} onClick={confirm}>
                  Confirmer le changement
                </Button>
              </div>
            </>
          ) : (
            <>
              <TextField
                label="Nouveau numéro"
                inputMode="tel"
                autoComplete="tel"
                placeholder="+224 620 00 00 00"
                value={newPhone}
                onChange={(event) => setNewPhone(event.target.value)}
                hint="Avec l’indicatif du pays : +224 (Guinée), +225 (Côte d’Ivoire), +221 (Sénégal), +223 (Mali)…"
              />
              <FormError message={errorText(requestChange.error)} />
              <div className="flex justify-end">
                <Button loading={requestChange.isPending} disabled={!phoneValid} onClick={sendCode}>
                  Recevoir le code par e-mail
                </Button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
