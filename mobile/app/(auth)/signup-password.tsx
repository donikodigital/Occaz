// mobile/app/(auth)/signup-password.tsx
// [11/10/2026] v1 — Création de compte, dernière étape : choisir son mot de passe à 6 chiffres (saisi, puis confirmé). Il sert désormais à
// CHAQUE connexion, à la place du code SMS. Cet écran n'a pas de bouton retour : le compte est déjà ouvert et ne doit pas rester sans mot
// de passe. Il sert aussi aux comptes créés avant ce changement (`mustSetPassword`).
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
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
import { useAuthFlowStore } from '@/stores/authFlowStore';
import { SIGNUP_STEP, SIGNUP_STEPS } from '@/components/auth/signupSteps';

export default function SignupPasswordScreen() {
  const user = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const resetFlow = useAuthFlowStore((state) => state.reset);

  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phase, setPhase] = useState<'choose' | 'confirm'>('choose');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const save = useMutation({ mutationFn: (password: string) => authApi.setPassword(password) });

  function goHome(accountType: string | undefined) {
    // Le conducteur garde ses informations en mémoire : « Complétez votre profil » les reprend (voir complete-profile.tsx).
    if (accountType !== 'DRIVER') resetFlow();
    router.replace(accountType === 'DRIVER' ? '/(driver)/(tabs)/home' : '/(customer)/(tabs)/home');
  }

  function handleChosen(value: string) {
    setErrorMessage(undefined);
    if (value.length !== PIN_LENGTH) return;
    setPhase('confirm');
    setConfirmation('');
  }

  function handleConfirmed(value: string) {
    if (value !== pin) {
      setErrorMessage('Les deux mots de passe ne sont pas identiques. Recommencez.');
      setConfirmation('');
      return;
    }
    setErrorMessage(undefined);
    save.mutate(pin, {
      onSuccess: (safeUser) => {
        updateUser(safeUser);
        goHome(safeUser.accountType);
      },
      onError: (error) => {
        const message = error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.';
        setErrorMessage(message);
        // Mot de passe refusé (trop simple…) : on revient à la première saisie.
        setPhase('choose');
        setPin('');
        setConfirmation('');
      },
    });
  }

  const confirming = phase === 'confirm';

  return (
    <AuthStep
      icon={<IconLock size={26} color={OCEAN.onDark} />}
      title={confirming ? 'Confirmez le mot de passe' : 'Choisissez votre mot de passe'}
      subtitle={
        confirming
          ? 'Saisissez-le une seconde fois.'
          : '6 chiffres. Il vous sera demandé à chaque connexion, à la place d’un code SMS.'
      }
      step={{ current: SIGNUP_STEP.password, total: SIGNUP_STEPS, label: 'Mot de passe' }}
      footer={
        confirming ? (
          <OceanButton
            label="Terminer"
            onPress={() => handleConfirmed(confirmation)}
            loading={save.isPending}
            disabled={confirmation.length !== PIN_LENGTH}
          />
        ) : (
          <OceanButton label="Continuer" onPress={() => handleChosen(pin)} disabled={pin.length !== PIN_LENGTH} />
        )
      }
    >
      {errorMessage ? <FeedbackBanner tone="error" text={errorMessage} onDismiss={() => setErrorMessage(undefined)} /> : null}

      {confirming ? (
        <PinCodeInput
          key="confirm"
          value={confirmation}
          onChange={(next) => {
            setConfirmation(next);
            setErrorMessage(undefined);
          }}
          onComplete={handleConfirmed}
          hasError={Boolean(errorMessage)}
        />
      ) : (
        <PinCodeInput
          key="choose"
          value={pin}
          onChange={(next) => {
            setPin(next);
            setErrorMessage(undefined);
          }}
          onComplete={handleChosen}
          hasError={Boolean(errorMessage)}
        />
      )}

      <AppText variant="xs" color="textMuted" align="center" style={styles.hint}>
        Évitez les suites (123456) et les chiffres répétés (111111). Ne communiquez jamais ce mot de passe, pas même à Occa’Z.
      </AppText>
      {user?.mustSetPassword ? (
        <AppText variant="xs" color="textMuted" align="center" style={styles.hint}>
          Votre compte existait déjà : définissez ce mot de passe une seule fois, il remplace désormais le code SMS.
        </AppText>
      ) : null}
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: spacing.sm },
});
