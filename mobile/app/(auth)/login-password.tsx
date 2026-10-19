// mobile/app/(auth)/login-password.tsx
// [19/10/2026] v+ — la connexion ouvre l'espace choisi à l'accueil (un compte peut avoir les deux espaces).
// [11/10/2026] v1 — Connexion, étape 2 : le mot de passe à 6 chiffres du numéro saisi à l'écran précédent. La connexion part toute seule au
// sixième chiffre ; « Se connecter » sert si on préfère valider soi-même. « Mot de passe oublié ? » ouvre la récupération par SMS ou e-mail,
// qui revient ici (avec un message de confirmation) une fois le nouveau mot de passe défini.
import React, { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconLock } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { PIN_LENGTH, PinCodeInput } from '@/components/auth/PinCodeInput';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import { useCountries } from '@/hooks/useCities';
import { formatInternationalPhone } from '@/utils/phone';
import { useActiveSpaceStore } from '@/stores/activeSpaceStore';
import { HOME_HREF } from '@/utils/spaces';
import type { AccountType } from '@/types/auth.types';

type Space = Extract<AccountType, 'CUSTOMER' | 'DRIVER'>;

export default function LoginPasswordScreen() {
  const { accountType: accountTypeParam, phone = '', notice } = useLocalSearchParams<{
    accountType?: Space;
    phone?: string;
    notice?: string;
  }>();
  const accountType: Space = accountTypeParam === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
  const setSession = useAuthStore((state) => state.setSession);
  const { data: countries } = useCountries();

  const [pin, setPin] = useState('');
  const [formError, setFormError] = useState<string | undefined>();
  const [showNotice, setShowNotice] = useState(Boolean(notice));

  // Retour de « Mot de passe oublié » : l'écran est déjà ouvert, seul le paramètre change.
  useEffect(() => {
    if (notice) {
      setShowNotice(true);
      setPin('');
      setFormError(undefined);
    }
  }, [notice]);

  const login = useMutation({
    mutationFn: (password: string) =>
      authApi.loginWithPhone({
        phone,
        password,
        expectedAccountType: accountType,
        device: { platform: Platform.OS as 'ios' | 'android' },
      }),
    onSuccess: async (result) => {
      await setSession(result);
      // Le serveur a accepté cet espace (compte de ce type, ou compte qui possède aussi ce profil) : on l'ouvre.
      useActiveSpaceStore.getState().setSpace(accountType);
      router.replace(HOME_HREF[accountType]);
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.');
      setPin('');
    },
  });

  // Écran ouvert sans numéro (lien direct, application relancée) : retour à la saisie du numéro.
  if (!phone) return <Redirect href={{ pathname: '/(auth)/login', params: { accountType } }} />;

  function submit(password: string) {
    if (login.isPending || password.length !== PIN_LENGTH) return;
    setFormError(undefined);
    setShowNotice(false);
    login.mutate(password);
  }

  return (
    <AuthStep
      icon={<IconLock size={26} color={OCEAN.onDark} />}
      title="Mot de passe"
      subtitle={`Entrez le mot de passe à 6 chiffres du ${formatInternationalPhone(countries, phone)}.`}
      onBack={() => router.back()}
      footer={<OceanButton label="Se connecter" onPress={() => submit(pin)} loading={login.isPending} disabled={pin.length !== PIN_LENGTH} />}
    >
      {showNotice ? (
        <FeedbackBanner
          tone="success"
          text="Votre mot de passe a été modifié. Connectez-vous avec le nouveau."
          onDismiss={() => setShowNotice(false)}
        />
      ) : null}

      <PinCodeInput
        value={pin}
        onChange={(next) => {
          setPin(next);
          setFormError(undefined);
        }}
        onComplete={submit}
        hasError={Boolean(formError)}
      />

      {formError ? <FeedbackBanner tone="error" text={formError} onDismiss={() => setFormError(undefined)} /> : null}

      <Pressable
        onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: { accountType, phone } })}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.forgot}
      >
        <AppText variant="sm" weight="semibold" color={OCEAN.base}>
          Mot de passe oublié ?
        </AppText>
      </Pressable>
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  forgot: { alignItems: 'center', paddingVertical: spacing.xs, marginTop: spacing.sm },
});
