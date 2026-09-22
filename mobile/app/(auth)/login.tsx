// mobile/app/(auth)/login.tsx
// [22/09/2026] v2 — Habillage bleu Ocean, dans l'esprit Tiime : illustration
// à étincelles au-dessus du titre, bouton retour en carte flottante, champ
// téléphone dans une carte. Logique inchangée.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconArrowLeft, IconPhone } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { isValidPhoneNumber, normalizePhoneInput } from '@/utils/phone';
import type { AccountType } from '@/types/auth.types';

export default function LoginScreen() {
  const { accountType } = useLocalSearchParams<{ accountType?: Extract<AccountType, 'CUSTOMER' | 'DRIVER'> }>();
  const [phone, setPhone] = useState('+224');
  const [fieldError, setFieldError] = useState<string | undefined>();

  const requestOtp = useMutation({
    mutationFn: () => authApi.requestOtp({ phone, signupAccountType: accountType }),
    onSuccess: () => {
      router.push({ pathname: '/(auth)/verify-otp', params: { phone, accountType } });
    },
    onError: (error) => {
      setFieldError(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    },
  });

  function handleContinue() {
    setFieldError(undefined);
    if (!isValidPhoneNumber(phone)) {
      setFieldError('Numéro invalide — utilisez le format international (ex: +224620000000).');
      return;
    }
    requestOtp.mutate();
  }

  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
      </View>

      <View style={styles.body}>
        <AuthIllustration icon={<IconPhone size={26} color={OCEAN.onDark} />} size={104} style={styles.illustration} />

        <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
          Votre numéro
        </AppText>
        <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
          Nous vous envoyons un code par SMS pour confirmer votre identité.
        </AppText>

        <TextField
          label="Téléphone"
          value={phone}
          onChangeText={(text) => setPhone(normalizePhoneInput(text))}
          placeholder="+224620000000"
          keyboardType="phone-pad"
          autoFocus
          leftIcon={<IconPhone size={18} color={OCEAN.base} />}
          error={fieldError}
        />
      </View>

      <OceanButton label="Continuer" onPress={handleContinue} loading={requestOtp.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
  },
  body: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  illustration: {
    alignSelf: 'center',
  },
  title: {
    marginTop: spacing.lg,
    marginBottom: spacing.xxs,
  },
  subtitle: {
    marginBottom: spacing.xl,
    alignSelf: 'stretch',
  },
  submit: {
    marginBottom: spacing.md,
  },
});