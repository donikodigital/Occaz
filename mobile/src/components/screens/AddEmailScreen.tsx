// mobile/src/components/screens/AddEmailScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [19/10/2026] v1 — Ajouter son adresse e-mail depuis l'app (après l'inscription), en deux temps : l'adresse, puis le code à 6 chiffres reçu
// par e-mail. Même parcours que l'étape facultative de l'inscription. Partagé par l'espace passager et l'espace conducteur.
// Erreurs affichées dans la page.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconMail, IconMailCheck } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { OtpCodeInput, OTP_CODE_LENGTH } from '@/components/screens/OtpCodeInput';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import { useT, translate } from '@/i18n';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : translate('Une erreur est survenue. Réessayez.');
}

export function AddEmailScreen() {
  const t = useT();
  const updateUser = useAuthStore((state) => state.updateUser);
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  const sendCode = useMutation({
    mutationFn: (address: string) => authApi.requestEmailCode(address),
    onSuccess: (_result, address) => {
      setSentTo(address);
      setCode('');
    },
    onError: (error) => setErrorMessage(messageOf(error)),
  });

  const verify = useMutation({
    mutationFn: (value: string) => authApi.verifyEmailCode(sentTo ?? '', value),
    onSuccess: (user) => {
      updateUser(user);
      setDone(true);
    },
    onError: (error) => {
      setCode('');
      setErrorMessage(messageOf(error));
    },
  });

  function handleSend() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setErrorMessage(t('Adresse e-mail invalide.'));
      return;
    }
    setErrorMessage(undefined);
    sendCode.mutate(address);
  }

  function handleVerify(value = code) {
    if (value.length !== OTP_CODE_LENGTH) {
      setErrorMessage(t('Saisissez le code à {OTP_CODE_LENGTH} chiffres reçu par e-mail.', { OTP_CODE_LENGTH }));
      return;
    }
    setErrorMessage(undefined);
    verify.mutate(value);
  }

  if (done) {
    return (
      <ScreenContainer maxWidth="form">
        <OceanScreenHeader title={t('Adresse e-mail')} onBack={() => router.back()} />
        <View style={styles.doneBody}>
          <IconMailCheck size={44} color={OCEAN.base} />
          <AppText variant="lg" weight="bold" color={OCEAN.deep} align="center">
            {t('Adresse e-mail ajoutée')}
          </AppText>
          <AppText variant="sm" color="textSecondary" align="center">
            {t('Vous recevrez désormais vos reçus et vos messages importants aussi par e-mail.')}
          </AppText>
          <OceanButton label={t('Terminer')} onPress={() => router.back()} style={styles.doneButton} />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader
        title={t('Adresse e-mail')}
        subtitle={t('Facultatif, mais très utile')}
        onBack={() => (sentTo ? setSentTo(null) : router.back())}
      />

      {sentTo ? (
        <OceanSection icon={<IconMailCheck size={17} color={OCEAN.base} />} title={t('Vérifiez votre e-mail')}>
          <AppText variant="sm" color="textSecondary" style={styles.help}>
            {t('Code à {OTP_CODE_LENGTH} chiffres envoyé à {sentTo}. Pensez à regarder dans vos courriers indésirables.', { OTP_CODE_LENGTH, sentTo })}
          </AppText>
          <OtpCodeInput value={code} onChange={setCode} onComplete={handleVerify} />
        </OceanSection>
      ) : (
        <OceanSection icon={<IconMail size={17} color={OCEAN.base} />} title={t('Votre adresse')}>
          <TextField
            label={t('Adresse e-mail')}
            value={email}
            onChangeText={(text) => {
              setEmail(text);
              setErrorMessage(undefined);
            }}
            placeholder={t('vous@exemple.com')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
          />
          <AppText variant="xs" color="textMuted">
            {t('Avec une adresse e-mail, vous pouvez retrouver votre compte si vous oubliez votre code, recevoir vos reçus et suivre vos colis.')}
          </AppText>
        </OceanSection>
      )}

      {errorMessage ? (
        <View style={styles.feedback}>
          <FeedbackBanner tone="error" text={errorMessage} onDismiss={() => setErrorMessage(undefined)} />
        </View>
      ) : null}

      {sentTo ? (
        <>
          <OceanButton label={t('Vérifier')} onPress={() => handleVerify()} loading={verify.isPending} />
          <OceanButton
            label={t('Renvoyer le code')}
            variant="outline"
            onPress={() => sendCode.mutate(sentTo)}
            loading={sendCode.isPending}
            style={styles.second}
          />
        </>
      ) : (
        <OceanButton label={t('Recevoir le code')} onPress={handleSend} loading={sendCode.isPending} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  help: { marginBottom: spacing.sm },
  feedback: { marginBottom: spacing.sm },
  second: { marginTop: spacing.sm, marginBottom: spacing.lg },
  doneBody: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  doneButton: { alignSelf: 'stretch', marginTop: spacing.md },
});
