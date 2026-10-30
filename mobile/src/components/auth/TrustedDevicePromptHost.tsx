// mobile/src/components/auth/TrustedDevicePromptHost.tsx
// [30/10/2026] v1 — La question « Enregistrer ce téléphone comme téléphone de confiance ? », posée après une connexion réussie.
//
// Montée une seule fois à la racine (app/_layout.tsx). La question apparaît quand la personne arrive dans son espace (jamais au milieu de
// l'inscription ou de la connexion) et revient à chaque connexion tant que le compte n'a aucun téléphone de confiance.
import React, { useState } from 'react';
import { useSegments } from 'expo-router';
import { ConfirmDialog } from '@/components/ui';
import { useAuthStore } from '@/stores/authStore';
import { useTrustedDeviceStore } from '@/stores/trustedDeviceStore';
import { useT } from '@/i18n';

export function TrustedDevicePromptHost() {
  const t = useT();
  const segments = useSegments();
  const user = useAuthStore((state) => state.user);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const offerPending = useTrustedDeviceStore((state) => state.offerPending);
  const register = useTrustedDeviceStore((state) => state.register);
  const dismissOffer = useTrustedDeviceStore((state) => state.dismissOffer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const inSpace = (segments[0] as string | undefined) === '(customer)' || (segments[0] as string | undefined) === '(driver)';
  const visible = offerPending && isAuthenticated && inSpace && Boolean(user) && !user!.mustSetPassword;

  async function accept() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    const result = await register();
    setBusy(false);
    if (!result.ok) setError(result.message ?? t('Une erreur est survenue. Réessayez.'));
  }

  function later() {
    setError(undefined);
    dismissOffer();
  }

  return (
    <ConfirmDialog
      visible={visible}
      title={t('Téléphone de confiance')}
      message={
        error ??
        t('Voulez-vous enregistrer ce téléphone comme téléphone de confiance ? Ensuite, se connecter depuis un autre téléphone demandera un code reçu par e-mail ou par SMS.')
      }
      confirmLabel={error ? t('Réessayer') : t('Oui, enregistrer')}
      cancelLabel={t('Pas maintenant')}
      loading={busy}
      onConfirm={() => void accept()}
      onCancel={later}
    />
  );
}
