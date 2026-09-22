// mobile/app/(auth)/verify-otp.tsx
// [22/09/2026] v2 — Habillage bleu Ocean, pour rester cohérent avec les deux
// écrans précédents du parcours (Bienvenue, Votre numéro) : illustration à
// étincelles, cases du code recolorées. Logique inchangée.
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconArrowLeft, IconMessage2 } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import type { AccountType } from '@/types/auth.types';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 45;

export default function VerifyOtpScreen() {
  const { phone, accountType } = useLocalSearchParams<{
    phone: string;
    accountType?: Extract<AccountType, 'CUSTOMER' | 'DRIVER'>;
  }>();
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const setSession = useAuthStore((state) => state.setSession);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const verifyOtp = useMutation({
    // Le code à vérifier est un paramètre de la mutation, jamais lu depuis
    // le state `code` du composant : setCode() est asynchrone, donc au
    // moment où mutate() s'exécute juste après un setCode(), le closure de
    // mutationFn peut encore pointer sur le rendu précédent — un code d'un
    // caractère plus court que celui qui vient d'être saisi (bug corrigé
    // le 15/09/2026).
    mutationFn: (codeToVerify: string) =>
      authApi.verifyOtp({
        phone,
        code: codeToVerify,
        device: { platform: Platform.OS as 'ios' | 'android' },
      }),
    onSuccess: async (result) => {
      await setSession(result);
      // Correction : le chauffeur doit aller dans le groupe (tabs) comme le
      // client, sinon il atterrit sur (driver)/home.tsx — un fichier hors
      // (tabs), orphelin depuis le commit initial, sans barre d'onglets et
      // sans aucun des écrans construits depuis (bug identifié le 16/09/2026).
      router.replace(result.user.accountType === 'DRIVER' ? '/(driver)/(tabs)/home' : '/(customer)/(tabs)/home');
    },
    onError: (error) => {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setCode('');
    },
  });

  const resendOtp = useMutation({
    mutationFn: () => authApi.requestOtp({ phone, signupAccountType: accountType }),
    onSuccess: () => setCooldown(RESEND_COOLDOWN_SECONDS),
  });

  function handleChangeCode(text: string) {
    const digitsOnly = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    setCode(digitsOnly);
    setErrorMessage(undefined);
    if (digitsOnly.length === CODE_LENGTH) {
      verifyOtp.mutate(digitsOnly);
    }
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
        <AuthIllustration icon={<IconMessage2 size={26} color={OCEAN.onDark} />} size={104} style={styles.illustration} />

        <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
          Entrez le code
        </AppText>
        <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
          Code envoyé au {phone}
        </AppText>

        <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.otpBox,
                {
                  borderColor: errorMessage ? colors.danger : code.length === index ? OCEAN.base : colors.border,
                  backgroundColor: code[index] !== undefined ? OCEAN.mist : colors.surface,
                },
              ]}
            >
              <AppText variant="xl" weight="semibold" color={OCEAN.deep}>
                {code[index] ?? ''}
              </AppText>
            </View>
          ))}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleChangeCode}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoFocus
          textContentType="oneTimeCode"
          style={styles.hiddenInput}
        />

        {errorMessage ? (
          <AppText variant="sm" color="danger" style={styles.error}>
            {errorMessage}
          </AppText>
        ) : null}

        <View style={styles.resendRow}>
          {cooldown > 0 ? (
            <AppText variant="sm" color="textMuted">
              Renvoyer le code dans {cooldown}s
            </AppText>
          ) : (
            <Pressable onPress={() => resendOtp.mutate()} disabled={resendOtp.isPending}>
              <AppText variant="sm" weight="semibold" color={OCEAN.base}>
                Renvoyer le code
              </AppText>
            </Pressable>
          )}
        </View>
      </View>

      <OceanButton
        label="Vérifier"
        onPress={() => verifyOtp.mutate(code)}
        loading={verifyOtp.isPending}
        disabled={code.length !== CODE_LENGTH}
        style={styles.submit}
      />
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
  },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  otpBox: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
  error: {
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  resendRow: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  submit: {
    marginBottom: spacing.md,
  },
});