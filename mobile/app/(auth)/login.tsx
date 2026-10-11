// mobile/app/(auth)/login.tsx
// [22/09/2026] v2 — Habillage bleu Ocean, dans l'esprit Tiime.
// [11/10/2026] v4 — Connexion par numéro de téléphone + mot de passe à 6 chiffres : PLUS AUCUN SMS à chaque connexion (les SMS ne servent
// qu'à l'inscription et au mot de passe oublié). Le pays proposé est celui défini par l'administration ; la pastille d'indicatif permet
// d'en choisir un autre. Le mot de passe se valide tout seul au sixième chiffre.
import React, { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconLogin } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { CountryPickerModal } from '@/components/auth/CountryField';
import { PhoneField } from '@/components/auth/PhoneField';
import { PIN_LENGTH, PinCodeInput } from '@/components/auth/PinCodeInput';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';
import { useDefaultSignupCountry } from '@/hooks/useSignupCountry';
import { buildInternationalPhone, isValidPhoneNumber } from '@/utils/phone';
import type { Country } from '@/types/geography.types';
import type { AccountType } from '@/types/auth.types';

type Space = Extract<AccountType, 'CUSTOMER' | 'DRIVER'>;

export default function LoginScreen() {
  const { accountType: accountTypeParam, phone: phoneParam, notice } = useLocalSearchParams<{
    accountType?: Space;
    phone?: string;
    notice?: string;
  }>();
  const accountType: Space = accountTypeParam === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
  const setSession = useAuthStore((state) => state.setSession);

  const [country, setCountry] = useState<Country | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Numéro revenu d'un autre écran (« +224620000010 ») : on le montre tel quel, l'indicatif étant accepté dans le champ.
  const [phone, setPhone] = useState(phoneParam ?? '');
  const [pin, setPin] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();
  const [showNotice, setShowNotice] = useState(Boolean(notice));

  useDefaultSignupCountry(country, setCountry);

  const login = useMutation({
    mutationFn: (payload: { international: string; password: string }) =>
      authApi.loginWithPhone({
        phone: payload.international,
        password: payload.password,
        expectedAccountType: accountType,
        device: { platform: Platform.OS as 'ios' | 'android' },
      }),
    onSuccess: async (result) => {
      await setSession(result);
      router.replace(result.user.accountType === 'DRIVER' ? '/(driver)/(tabs)/home' : '/(customer)/(tabs)/home');
    },
    onError: (error) => {
      setFormError(error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.');
      setPin('');
    },
  });

  function submit(password: string) {
    if (login.isPending) return;
    setFormError(undefined);
    setShowNotice(false);
    const international = buildInternationalPhone(country?.phoneCode ?? '', phone);
    if (!country || !isValidPhoneNumber(international)) {
      setPhoneError('Numéro invalide. Vérifiez-le sans l’indicatif du pays.');
      setPin('');
      return;
    }
    setPhoneError(undefined);
    login.mutate({ international, password });
  }

  const forgotParams = { accountType, phone: buildInternationalPhone(country?.phoneCode ?? '', phone) };

  return (
    <AuthStep
      icon={<IconLogin size={26} color={OCEAN.onDark} />}
      title="Connexion"
      subtitle={accountType === 'DRIVER' ? 'Espace conducteur' : 'Espace client'}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/onboarding'))}
      footer={<OceanButton label="Se connecter" onPress={() => submit(pin)} loading={login.isPending} disabled={pin.length !== PIN_LENGTH} />}
    >
      {showNotice ? (
        <FeedbackBanner
          tone="success"
          text="Votre mot de passe a été modifié. Connectez-vous avec le nouveau."
          onDismiss={() => setShowNotice(false)}
        />
      ) : null}

      <PhoneField
        country={country}
        value={phone}
        onChangeText={(text) => {
          setPhone(text);
          setPhoneError(undefined);
        }}
        onPressCountry={() => setPickerOpen(true)}
        error={phoneError}
      />

      <PinCodeInput
        label="Mot de passe"
        value={pin}
        onChange={(next) => {
          setPin(next);
          setFormError(undefined);
        }}
        onComplete={submit}
        hasError={Boolean(formError)}
        autoFocus={false}
      />

      {formError ? <FeedbackBanner tone="error" text={formError} onDismiss={() => setFormError(undefined)} /> : null}

      <Pressable
        onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: forgotParams })}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.forgot}
      >
        <AppText variant="sm" weight="semibold" color={OCEAN.base}>
          Mot de passe oublié ?
        </AppText>
      </Pressable>

      <View style={styles.create}>
        <AppText variant="sm" color="textSecondary">
          Pas encore de compte ?{' '}
        </AppText>
        <Pressable
          onPress={() => router.replace({ pathname: '/(auth)/signup', params: { accountType } })}
          accessibilityRole="button"
          hitSlop={8}
        >
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            Créer un compte
          </AppText>
        </Pressable>
      </View>

      <CountryPickerModal
        visible={pickerOpen}
        selectedId={country?.id}
        onSelect={setCountry}
        onClose={() => setPickerOpen(false)}
      />
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  forgot: { alignItems: 'center', paddingVertical: spacing.xs },
  create: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
});
