// mobile/app/(auth)/verify-device.tsx
// [30/10/2026] v1 — Connexion depuis un téléphone qui n'est pas de confiance : le code reçu par e-mail (en priorité) ou par SMS confirme ce
// téléphone et ouvre la session. La question « Enregistrer ce téléphone comme téléphone de confiance ? » est posée à l'arrivée dans l'espace.
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconDeviceMobileCheck } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { CodeEntryStep } from '@/components/auth/CodeEntryStep';
import { OCEAN } from '@/theme/ocean';
import { spacing } from '@/theme';
import { trustedDeviceApi } from '@/services/api/trustedDevice.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import { useActiveSpaceStore } from '@/stores/activeSpaceStore';
import { useDeviceChallengeStore } from '@/stores/deviceChallengeStore';
import { useTrustedDeviceStore } from '@/stores/trustedDeviceStore';
import { HOME_HREF } from '@/utils/spaces';
import { useT } from '@/i18n';

export default function VerifyDeviceScreen() {
  const t = useT();
  const challenge = useDeviceChallengeStore((state) => state.challenge);
  const updateChallenge = useDeviceChallengeStore((state) => state.update);
  const clearChallenge = useDeviceChallengeStore((state) => state.clear);
  const setSession = useAuthStore((state) => state.setSession);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const verify = useMutation({
    mutationFn: (code: string) =>
      trustedDeviceApi.verify({ challengeToken: challenge!.challengeToken, code, device: { platform: Platform.OS as 'ios' | 'android' } }),
  });

  // Écran ouvert sans connexion en cours (lien direct, application relancée) : retour à l'accueil.
  if (!challenge) return <Redirect href="/(auth)/onboarding" />;

  const { space } = challenge;

  function handleSubmit(code: string, clear: () => void) {
    setErrorMessage(undefined);
    verify.mutate(code, {
      onSuccess: async (result) => {
        await setSession(result);
        useActiveSpaceStore.getState().setSpace(space);
        clearChallenge();
        // La question « Enregistrer ce téléphone ? » s'affichera à l'arrivée dans l'espace.
        await useTrustedDeviceStore.getState().noteLogin(result.trust);
        router.replace(HOME_HREF[space]);
      },
      onError: (error) => {
        if (error instanceof ApiError && error.isAuthError && /Reconnectez-vous/i.test(error.message)) {
          // Le jeton de cette étape a expiré (10 minutes) : il faut recommencer la connexion.
          clearChallenge();
          router.replace({ pathname: '/(auth)/login', params: { accountType: space } });
          return;
        }
        setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue. Réessayez.'));
        clear();
      },
    });
  }

  async function resend(channel?: 'SMS') {
    try {
      const next = await trustedDeviceApi.resend({ challengeToken: challenge!.challengeToken, channel });
      updateChallenge(next);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : t('Impossible de renvoyer le code pour le moment.'));
      throw error;
    }
  }

  const viaEmail = challenge.channel === 'EMAIL';

  return (
    <CodeEntryStep
      icon={<IconDeviceMobileCheck size={26} color={OCEAN.onDark} />}
      title={t('Confirmez ce téléphone')}
      subtitle={
        viaEmail
          ? t('Pour votre sécurité, nous avons envoyé un code à {destination}.', { destination: challenge.destination })
          : t('Pour votre sécurité, nous avons envoyé un code par SMS au {destination}.', { destination: challenge.destination })
      }
      onBack={() => {
        clearChallenge();
        router.back();
      }}
      onSubmit={handleSubmit}
      isSubmitting={verify.isPending}
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(undefined)}
      onResend={() => resend()}
    >
      {viaEmail && challenge.canUseSms ? (
        <Pressable
          onPress={() => void resend('SMS').catch(() => undefined)}
          accessibilityRole="button"
          hitSlop={8}
          style={styles.sms}
        >
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            {t('Recevoir le code par SMS à la place')}
          </AppText>
        </Pressable>
      ) : null}
    </CodeEntryStep>
  );
}

const styles = StyleSheet.create({
  sms: { alignItems: 'center', paddingVertical: spacing.xs, marginTop: spacing.md },
});
