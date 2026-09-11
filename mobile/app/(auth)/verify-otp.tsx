// mobile/app/(auth)/verify-otp.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconArrowLeft } from '@tabler/icons-react-native';
import { AppText, Button, IconButton, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
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
    mutationFn: () =>
      authApi.verifyOtp({ phone, code, device: { platform: Platform.OS as 'ios' | 'android' } }),
    onSuccess: async (result) => {
      await setSession(result);
      router.replace(result.user.accountType === 'DRIVER' ? '/(driver)/home' : '/(customer)/(tabs)/home');
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
      verifyOtp.mutate();
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
        <AppText variant="xxl" weight="semibold" style={styles.title}>
          Entrez le code
        </AppText>
        <AppText variant="base" color="textSecondary" style={styles.subtitle}>
          Code envoyé au {phone}
        </AppText>

        <Pressable onPress={() => inputRef.current?.focus()} style={styles.otpRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.otpBox,
                {
                  borderColor: errorMessage
                    ? colors.danger
                    : code.length === index
                      ? colors.primary
                      : colors.border,
                },
              ]}
            >
              <AppText variant="xl" weight="semibold">
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
              <AppText variant="sm" weight="semibold" color="primary">
                Renvoyer le code
              </AppText>
            </Pressable>
          )}
        </View>
      </View>

      <Button
        label="Vérifier"
        onPress={() => verifyOtp.mutate()}
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
    paddingTop: spacing.xl,
  },
  title: {
    marginBottom: spacing.xxs,
  },
  subtitle: {
    marginBottom: spacing.xl,
  },
  otpRow: {
    flexDirection: 'row',
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
  },
  resendRow: {
    marginTop: spacing.lg,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
