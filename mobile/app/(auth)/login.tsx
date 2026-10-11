// mobile/app/(auth)/login.tsx
// [22/09/2026] v2 — Habillage bleu Ocean, dans l'esprit Tiime.
// [11/10/2026] v5 — Connexion par numéro + mot de passe, EN DEUX ÉCRANS comme avant le passage au mot de passe :
//   1. ce écran : le numéro de téléphone (pays proposé = celui défini par l'administration, indicatif et drapeau, espaces posés selon le
//      pays) puis « Continuer » ;
//   2. login-password.tsx : le mot de passe à 6 chiffres.
// Plus aucun SMS à la connexion : les SMS ne servent qu'à l'inscription et au mot de passe oublié.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconLogin } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { CountryPickerModal } from '@/components/auth/CountryField';
import { PhoneField } from '@/components/auth/PhoneField';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useDefaultSignupCountry } from '@/hooks/useSignupCountry';
import { buildInternationalPhone, formatNationalPhone, isValidPhoneNumber } from '@/utils/phone';
import type { Country } from '@/types/geography.types';
import type { AccountType } from '@/types/auth.types';

type Space = Extract<AccountType, 'CUSTOMER' | 'DRIVER'>;

export default function LoginScreen() {
  const { accountType: accountTypeParam } = useLocalSearchParams<{ accountType?: Space }>();
  const accountType: Space = accountTypeParam === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';

  const [country, setCountry] = useState<Country | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneError, setPhoneError] = useState<string | undefined>();

  useDefaultSignupCountry(country, setCountry);

  function handleContinue() {
    const international = buildInternationalPhone(country?.phoneCode ?? '', phone, country?.isoCode);
    if (!country || !isValidPhoneNumber(international)) {
      setPhoneError('Numéro invalide. Vérifiez-le sans l’indicatif du pays.');
      return;
    }
    setPhoneError(undefined);
    router.push({ pathname: '/(auth)/login-password', params: { accountType, phone: international } });
  }

  function handleSelectCountry(next: Country) {
    setCountry(next);
    // Le numéro déjà saisi est remis en forme selon les espaces du nouveau pays.
    setPhone((current) => formatNationalPhone(next.isoCode, current));
    setPhoneError(undefined);
  }

  return (
    <AuthStep
      icon={<IconLogin size={26} color={OCEAN.onDark} />}
      title="Connexion"
      subtitle={accountType === 'DRIVER' ? 'Espace conducteur · Indiquez votre numéro de téléphone.' : 'Espace client · Indiquez votre numéro de téléphone.'}
      onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/onboarding'))}
      footer={<OceanButton label="Continuer" onPress={handleContinue} />}
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

      <CountryPickerModal visible={pickerOpen} selectedId={country?.id} onSelect={handleSelectCountry} onClose={() => setPickerOpen(false)} />
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  create: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
});
