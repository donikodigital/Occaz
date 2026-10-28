// mobile/app/(auth)/forgot-password-new.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [11/10/2026] v1 — Mot de passe oublié, étape 3 : choisir un nouveau mot de passe à 6 chiffres (saisi, puis confirmé). Ensuite retour à
// l'écran « Mot de passe » de la connexion, numéro conservé, avec un message de confirmation.
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconLockCheck } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { PIN_LENGTH, PinCodeInput } from '@/components/auth/PinCodeInput';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthFlowStore } from '@/stores/authFlowStore';
import { useT } from '@/i18n';

export default function ForgotPasswordNewScreen() {
  const t = useT();
  const { phone = '', accountType = 'CUSTOMER' } = useLocalSearchParams<{ phone?: string; accountType?: string }>();
  const resetToken = useAuthFlowStore((state) => state.resetToken);
  const setResetToken = useAuthFlowStore((state) => state.setResetToken);

  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [phase, setPhase] = useState<'choose' | 'confirm'>('choose');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const reset = useMutation({ mutationFn: (password: string) => authApi.resetPassword(resetToken ?? '', password) });

  // Jeton absent (écran rouvert après un redémarrage de l'application) : on repart du début.
  if (!resetToken) return <Redirect href={{ pathname: '/(auth)/forgot-password', params: { phone, accountType } }} />;

  function handleChosen(value: string) {
    if (value.length !== PIN_LENGTH) return;
    setErrorMessage(undefined);
    setPhase('confirm');
    setConfirmation('');
  }

  function handleConfirmed(value: string) {
    if (value !== pin) {
      setErrorMessage(t('Les deux mots de passe ne sont pas identiques. Recommencez.'));
      setConfirmation('');
      return;
    }
    setErrorMessage(undefined);
    reset.mutate(pin, {
      onSuccess: () => {
        setResetToken(null);
        // Retour à l'écran du mot de passe de la connexion, déjà ouvert plus bas dans la pile : le numéro est conservé.
        router.dismissTo({ pathname: '/(auth)/login-password', params: { phone, accountType, notice: String(Date.now()) } });
      },
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue. Réessayez.'));
        setPhase('choose');
        setPin('');
        setConfirmation('');
      },
    });
  }

  const confirming = phase === 'confirm';

  return (
    <AuthStep
      icon={<IconLockCheck size={26} color={OCEAN.onDark} />}
      title={confirming ? t('Confirmez le mot de passe') : t('Nouveau mot de passe')}
      subtitle={confirming ? t('Saisissez-le une seconde fois.') : t('6 chiffres, qui remplaceront l’ancien mot de passe.')}
      footer={
        confirming ? (
          <OceanButton
            label={t('Enregistrer')}
            onPress={() => handleConfirmed(confirmation)}
            loading={reset.isPending}
            disabled={confirmation.length !== PIN_LENGTH}
          />
        ) : (
          <OceanButton label={t('Continuer')} onPress={() => handleChosen(pin)} disabled={pin.length !== PIN_LENGTH} />
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
        {t('Évitez les suites (123456) et les chiffres répétés (111111).')}
      </AppText>
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  hint: { marginTop: spacing.sm },
});
