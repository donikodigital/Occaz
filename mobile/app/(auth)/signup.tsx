// mobile/app/(auth)/signup.tsx
// [11/10/2026] v1 — Création de compte, étape 1 : nom, prénom, pays de résidence (celui que l'administration a défini par défaut, avec son
// indicatif et son drapeau), puis téléphone. « Continuer » envoie IMMÉDIATEMENT le code SMS qui vérifie le numéro (écran suivant).
// Les informations saisies restent en mémoire (authFlowStore) jusqu'à la fin de l'inscription.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconUserPlus } from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { CountryField } from '@/components/auth/CountryField';
import { PhoneField } from '@/components/auth/PhoneField';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthFlowStore, type SignupAccountType } from '@/stores/authFlowStore';
import { useDefaultSignupCountry } from '@/hooks/useSignupCountry';
import { buildInternationalPhone, isValidPhoneNumber } from '@/utils/phone';
import type { Country } from '@/types/geography.types';

export const SIGNUP_STEPS = 4;

export default function SignupScreen() {
  const { accountType: accountTypeParam } = useLocalSearchParams<{ accountType?: SignupAccountType }>();
  const accountType: SignupAccountType = accountTypeParam === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
  const setSignup = useAuthFlowStore((state) => state.setSignup);

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ lastName?: string; firstName?: string; country?: string; phone?: string; form?: string }>({});

  useDefaultSignupCountry(country, setCountry);

  const sendCode = useMutation({
    mutationFn: (international: string) => authApi.signupPhone({ phone: international, accountType }),
    onSuccess: (_result, international) => {
      setSignup({ accountType, lastName: lastName.trim(), firstName: firstName.trim(), country, phone: international });
      router.push('/(auth)/verify-otp');
    },
    onError: (error) => {
      setErrors({ form: error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.' });
    },
  });

  function handleContinue() {
    const next: typeof errors = {};
    if (lastName.trim().length < 2) next.lastName = 'Indiquez votre nom.';
    if (firstName.trim().length < 2) next.firstName = 'Indiquez votre prénom.';
    if (!country) next.country = 'Choisissez votre pays de résidence.';
    const international = country ? buildInternationalPhone(country.phoneCode, phone) : '';
    if (country && !isValidPhoneNumber(international)) next.phone = 'Numéro invalide. Vérifiez-le sans l’indicatif du pays.';
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    sendCode.mutate(international);
  }

  return (
    <AuthStep
      icon={<IconUserPlus size={26} color={OCEAN.onDark} />}
      title={accountType === 'DRIVER' ? 'Compte conducteur' : 'Créer votre compte'}
      subtitle="Un code vous sera envoyé par SMS pour vérifier votre numéro."
      onBack={() => router.back()}
      step={{ current: 1, total: SIGNUP_STEPS, label: 'Vos informations' }}
      footer={<OceanButton label="Continuer" onPress={handleContinue} loading={sendCode.isPending} />}
    >
      <TextField
        label="Nom"
        value={lastName}
        onChangeText={setLastName}
        placeholder="Diallo"
        autoCapitalize="words"
        autoComplete="family-name"
        textContentType="familyName"
        returnKeyType="next"
        error={errors.lastName}
        autoFocus
      />
      <TextField
        label="Prénom"
        value={firstName}
        onChangeText={setFirstName}
        placeholder="Fatoumata"
        autoCapitalize="words"
        autoComplete="given-name"
        textContentType="givenName"
        returnKeyType="next"
        error={errors.firstName}
      />
      <CountryField label="Pays de résidence" value={country} onSelect={setCountry} error={errors.country} />
      <PhoneField country={country} value={phone} onChangeText={setPhone} error={errors.phone} />

      {errors.form ? (
        <AppText variant="sm" color="danger" align="center" style={styles.formError}>
          {errors.form}
        </AppText>
      ) : null}

      <View style={styles.already}>
        <AppText variant="sm" color="textSecondary">
          Déjà un compte ?{' '}
        </AppText>
        <Pressable
          onPress={() => router.replace({ pathname: '/(auth)/login', params: { accountType } })}
          accessibilityRole="button"
          hitSlop={8}
        >
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            Se connecter
          </AppText>
        </Pressable>
      </View>
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  formError: { marginTop: spacing.xs },
  already: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
});
