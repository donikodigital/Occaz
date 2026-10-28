// mobile/app/(auth)/forgot-password-code.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [11/10/2026] v1 — Mot de passe oublié, étape 2 : le code à 6 chiffres reçu par SMS ou par e-mail. Un code correct donne un jeton
// (gardé en mémoire seulement) qui autorise le choix du nouveau mot de passe.
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconMailCheck, IconMessage2 } from '@tabler/icons-react-native';
import { CodeEntryStep } from '@/components/auth/CodeEntryStep';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthFlowStore } from '@/stores/authFlowStore';
import type { PasswordResetChannel } from '@/types/auth.types';
import { useT } from '@/i18n';

export default function ForgotPasswordCodeScreen() {
  const t = useT();
  const { phone = '', channel = 'SMS', destination = '', accountType = 'CUSTOMER' } = useLocalSearchParams<{
    phone?: string;
    channel?: string;
    destination?: string;
    accountType?: string;
  }>();
  const resetChannel: PasswordResetChannel = channel === 'EMAIL' ? 'EMAIL' : 'SMS';
  const setResetToken = useAuthFlowStore((state) => state.setResetToken);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const verify = useMutation({ mutationFn: (code: string) => authApi.verifyPasswordReset(phone, code) });

  function handleSubmit(code: string, clear: () => void) {
    setErrorMessage(undefined);
    verify.mutate(code, {
      onSuccess: ({ resetToken }) => {
        setResetToken(resetToken);
        router.replace({ pathname: '/(auth)/forgot-password-new', params: { phone, accountType } });
      },
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue. Réessayez.'));
        clear();
      },
    });
  }

  const Icon = resetChannel === 'EMAIL' ? IconMailCheck : IconMessage2;

  return (
    <CodeEntryStep
      icon={<Icon size={26} color={OCEAN.onDark} />}
      title={t('Entrez le code')}
      subtitle={
        resetChannel === 'EMAIL'
          ? t('Code envoyé par e-mail à {destination}. Pensez à regarder dans vos courriers indésirables.', { destination })
          : t('Code envoyé par SMS au {value}', { value: destination || phone })
      }
      onBack={() => router.back()}
      onSubmit={handleSubmit}
      isSubmitting={verify.isPending}
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(undefined)}
      onResend={async () => {
        try {
          await authApi.requestPasswordReset(phone, resetChannel);
        } catch (error) {
          setErrorMessage(error instanceof ApiError ? error.message : t('Impossible de renvoyer le code pour le moment.'));
          throw error;
        }
      }}
    />
  );
}
