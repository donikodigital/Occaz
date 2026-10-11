// mobile/app/(auth)/verify-otp.tsx
// [11/10/2026] v3 — Création de compte, étape 2 : le code à 6 chiffres envoyé par SMS au numéro de l'étape précédente. Le bon code prouve le
// numéro et ouvre la session ; le profil client (nom, prénom, pays) est alors créé avec ce qui a été saisi à l'étape 1 (le conducteur le
// complète avec sa ville dans « Complétez votre profil »). Plus aucune connexion ne passe par un SMS : voir login.tsx.
import React, { useState } from 'react';
import { Platform } from 'react-native';
import { Redirect, router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconMessage2 } from '@tabler/icons-react-native';
import { CodeEntryStep } from '@/components/auth/CodeEntryStep';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import { useAuthFlowStore } from '@/stores/authFlowStore';
import { useCreateCustomerProfile } from '@/hooks/useCustomerProfile';
import { SIGNUP_STEPS } from './signup';

export default function VerifyPhoneCodeScreen() {
  const { phone, accountType, firstName, lastName, country } = useAuthFlowStore();
  const setSession = useAuthStore((state) => state.setSession);
  const createCustomerProfile = useCreateCustomerProfile();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const verify = useMutation({
    mutationFn: (code: string) =>
      authApi.verifySignupPhone({ phone, code, device: { platform: Platform.OS as 'ios' | 'android' } }),
  });

  // Écran ouvert sans passer par la saisie des informations (lien direct, application relancée) : retour au début.
  if (!phone) return <Redirect href="/(auth)/onboarding" />;

  function handleSubmit(code: string, clear: () => void) {
    setErrorMessage(undefined);
    verify.mutate(code, {
      onSuccess: async (result) => {
        await setSession(result);
        if (accountType === 'CUSTOMER') {
          // Un échec ici n'arrête pas l'inscription : « Complétez votre profil » reprendra la saisie au premier lancement.
          await createCustomerProfile
            .mutateAsync({ firstName, lastName, countryId: country?.id })
            .catch(() => undefined);
        }
        router.replace('/(auth)/signup-email');
      },
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.');
        clear();
      },
    });
  }

  return (
    <CodeEntryStep
      icon={<IconMessage2 size={26} color={OCEAN.onDark} />}
      title="Entrez le code"
      subtitle={`Code envoyé par SMS au ${phone}`}
      onBack={() => router.back()}
      step={{ current: 2, total: SIGNUP_STEPS, label: 'Vérification du numéro' }}
      onSubmit={handleSubmit}
      isSubmitting={verify.isPending}
      errorMessage={errorMessage}
      onClearError={() => setErrorMessage(undefined)}
      onResend={async () => {
        try {
          await authApi.signupPhone({ phone, accountType });
        } catch (error) {
          setErrorMessage(error instanceof ApiError ? error.message : 'Impossible de renvoyer le code pour le moment.');
          throw error;
        }
      }}
    />
  );
}
