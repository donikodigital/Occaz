// mobile/app/(auth)/signup-email-code.tsx
// [11/10/2026] v1 — Création de compte, étape 3 (suite) : le code à 6 chiffres reçu dans la boîte mail. Un code correct marque l'adresse
// comme vérifiée, puis l'inscription continue vers le mot de passe.
import React, { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconMailCheck } from '@tabler/icons-react-native';
import { CodeEntryStep } from '@/components/auth/CodeEntryStep';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import { SIGNUP_STEPS } from './signup';

export default function VerifyEmailCodeScreen() {
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const verify = useMutation({ mutationFn: (code: string) => authApi.verifyEmailCode(email, code) });

  function handleSubmit(code: string, clear: () => void) {
    setErrorMessage(undefined);
    verify.mutate(code, {
      onSuccess: (user) => {
        updateUser(user);
        router.replace('/(auth)/signup-password');
      },
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.');
        clear();
      },
    });
  }

  return (
    <CodeEntryStep
      icon={<IconMailCheck size={26} color={OCEAN.onDark} />}
      title="Vérifiez votre e-mail"
      subtitle={`Code à 6 chiffres envoyé à ${email}. Pensez à regarder dans vos courriers indésirables.`}
      onBack={() => router.back()}
      step={{ current: 3, total: SIGNUP_STEPS, label: 'Vérification de l’e-mail' }}
      onSubmit={handleSubmit}
      isSubmitting={verify.isPending}
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(undefined)}
      onResend={async () => {
        try {
          await authApi.requestEmailCode(email);
        } catch (error) {
          setErrorMessage(error instanceof ApiError ? error.message : 'Impossible de renvoyer le code pour le moment.');
          throw error;
        }
      }}
    />
  );
}
