// mobile/src/components/auth/CodeEntryStep.tsx
// [11/10/2026] v1 — Écran « Entrez le code » commun à la vérification du numéro, de l'e-mail et du mot de passe oublié : six cases, envoi
// automatique dès le dernier chiffre, erreur dans la page, « Renvoyer le code » après un délai. La saisie automatique du code reçu par SMS
// est proposée par le clavier (iOS : au-dessus du clavier ; Android : suggestion du clavier Google).
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { OtpCodeInput, OTP_CODE_LENGTH } from '@/components/screens/OtpCodeInput';
import { AuthStep, type AuthStepProps } from '@/components/auth/AuthStep';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

const RESEND_COOLDOWN_SECONDS = 45;

export interface CodeEntryStepProps extends Pick<AuthStepProps, 'icon' | 'title' | 'subtitle' | 'onBack' | 'step'> {
  /** Appelé avec le code complet ; `clear` vide les cases (à appeler si le code est refusé). */
  onSubmit: (code: string, clear: () => void) => void;
  isSubmitting: boolean;
  errorMessage?: string;
  onClearError: () => void;
  /** Redemande un code. La promesse se résout quand il est parti : le délai avant un nouvel envoi repart alors. */
  onResend: () => Promise<unknown>;
  submitLabel?: string;
  children?: React.ReactNode;
}

export function CodeEntryStep({
  onSubmit,
  isSubmitting,
  errorMessage,
  onClearError,
  onResend,
  submitLabel = 'Vérifier',
  children,
  ...stepProps
}: CodeEntryStepProps) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function submit(value: string) {
    if (isSubmitting) return;
    onSubmit(value, () => setCode(''));
  }

  async function resend() {
    setResending(true);
    onClearError();
    try {
      await onResend();
      setCode('');
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      // L'erreur est affichée par l'écran appelant (onResend la lui a déjà transmise).
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthStep
      {...stepProps}
      footer={
        <OceanButton
          label={submitLabel}
          onPress={() => submit(code)}
          loading={isSubmitting}
          disabled={code.length !== OTP_CODE_LENGTH}
        />
      }
    >
      <OtpCodeInput
        value={code}
        onChange={(next) => {
          setCode(next);
          onClearError();
        }}
        onComplete={submit}
        hasError={Boolean(errorMessage)}
      />

      {errorMessage ? (
        <AppText variant="sm" color="danger" align="center" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      {children}

      <View style={styles.resendRow}>
        {cooldown > 0 ? (
          <AppText variant="sm" color="textMuted">
            Renvoyer le code dans {cooldown} s
          </AppText>
        ) : (
          <Pressable onPress={() => void resend()} disabled={resending} accessibilityRole="button">
            <AppText variant="sm" weight="semibold" color={OCEAN.base}>
              {resending ? 'Envoi…' : 'Renvoyer le code'}
            </AppText>
          </Pressable>
        )}
      </View>
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  error: { marginTop: spacing.sm },
  resendRow: { marginTop: spacing.lg, alignItems: 'center' },
});
