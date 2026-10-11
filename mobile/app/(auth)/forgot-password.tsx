// mobile/app/(auth)/forgot-password.tsx
// [11/10/2026] v1 — Mot de passe oublié, étape 1 : le numéro de téléphone, puis le choix de l'envoi du code — par SMS au numéro, ou par
// e-mail (si le compte a une adresse vérifiée ; sinon le serveur l'explique et on propose le SMS).
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconKey, IconMail, IconMessage2 } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { CountryPickerModal } from '@/components/auth/CountryField';
import { PhoneField } from '@/components/auth/PhoneField';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useDefaultSignupCountry } from '@/hooks/useSignupCountry';
import { buildInternationalPhone, isValidPhoneNumber } from '@/utils/phone';
import type { Country } from '@/types/geography.types';
import type { PasswordResetChannel } from '@/types/auth.types';

export default function ForgotPasswordScreen() {
  const { accountType = 'CUSTOMER', phone: phoneParam } = useLocalSearchParams<{ accountType?: string; phone?: string }>();
  const [country, setCountry] = useState<Country | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phone, setPhone] = useState(phoneParam && phoneParam.length > 5 ? phoneParam : '');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [pendingChannel, setPendingChannel] = useState<PasswordResetChannel | null>(null);

  useDefaultSignupCountry(country, setCountry);

  const request = useMutation({
    mutationFn: (vars: { international: string; channel: PasswordResetChannel }) =>
      authApi.requestPasswordReset(vars.international, vars.channel),
    onSuccess: (result, vars) => {
      router.push({
        pathname: '/(auth)/forgot-password-code',
        params: { phone: vars.international, channel: vars.channel, destination: result.destination, accountType },
      });
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.');
    },
    onSettled: () => setPendingChannel(null),
  });

  function send(channel: PasswordResetChannel) {
    setFormError(undefined);
    const international = buildInternationalPhone(country?.phoneCode ?? '', phone);
    if (!country || !isValidPhoneNumber(international)) {
      setPhoneError('Numéro invalide. Vérifiez-le sans l’indicatif du pays.');
      return;
    }
    setPhoneError(undefined);
    setPendingChannel(channel);
    request.mutate({ international, channel });
  }

  return (
    <AuthStep
      icon={<IconKey size={26} color={OCEAN.onDark} />}
      title="Mot de passe oublié"
      subtitle="Indiquez votre numéro, puis choisissez comment recevoir un code pour en définir un nouveau."
      onBack={() => router.back()}
      footer={
        <View style={styles.footer}>
          <OceanButton
            label="Recevoir le code par SMS"
            onPress={() => send('SMS')}
            loading={request.isPending && pendingChannel === 'SMS'}
            disabled={request.isPending && pendingChannel !== 'SMS'}
          />
          <OceanButton
            label="Recevoir le code par e-mail"
            variant="outline"
            onPress={() => send('EMAIL')}
            loading={request.isPending && pendingChannel === 'EMAIL'}
            disabled={request.isPending && pendingChannel !== 'EMAIL'}
          />
        </View>
      }
    >
      <PhoneField
        country={country}
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          setPhoneError(undefined);
        }}
        onPressCountry={() => setPickerOpen(true)}
        error={phoneError}
        autoFocus
      />

      {formError ? <FeedbackBanner tone="error" text={formError} onDismiss={() => setFormError(undefined)} /> : null}

      <View style={styles.channels}>
        <View style={styles.channel}>
          <IconMessage2 size={16} color={OCEAN.base} />
          <AppText variant="xs" color="textSecondary" style={styles.channelText}>
            Par SMS : un code est envoyé au numéro ci-dessus.
          </AppText>
        </View>
        <View style={styles.channel}>
          <IconMail size={16} color={OCEAN.base} />
          <AppText variant="xs" color="textSecondary" style={styles.channelText}>
            Par e-mail : possible si vous avez ajouté et vérifié une adresse e-mail à votre compte.
          </AppText>
        </View>
      </View>

      <CountryPickerModal visible={pickerOpen} selectedId={country?.id} onSelect={setCountry} onClose={() => setPickerOpen(false)} />
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  footer: { gap: spacing.sm },
  channels: { gap: spacing.sm, marginTop: spacing.sm },
  channel: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  channelText: { flex: 1 },
});
