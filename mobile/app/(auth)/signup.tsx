// mobile/app/(auth)/signup.tsx
// [11/10/2026] v2 — Création de compte pas à pas : UNE question par écran, avec « Continuer » :
//   1. nom de famille → 2. prénom → 3. pays de résidence (sans indicatif) → 4. téléphone (avec drapeau et indicatif du pays choisi).
// « Continuer » à l'étape du téléphone envoie IMMÉDIATEMENT le code SMS qui vérifie le numéro (écran suivant). Le bouton retour (et le
// retour du téléphone Android) revient à la question précédente ; à la première, il quitte l'inscription.
// Les informations saisies restent en mémoire (authFlowStore) jusqu'à la fin de l'inscription.
import React, { useEffect, useState } from 'react';
import { BackHandler, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconFlag, IconPhone, IconUser, IconUserPlus } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, TextField } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { CountryField } from '@/components/auth/CountryField';
import { PhoneField } from '@/components/auth/PhoneField';
import { SIGNUP_STEP, SIGNUP_STEPS } from '@/components/auth/signupSteps';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthFlowStore, type SignupAccountType } from '@/stores/authFlowStore';
import { useDefaultSignupCountry } from '@/hooks/useSignupCountry';
import { buildInternationalPhone, isValidPhoneNumber } from '@/utils/phone';
import type { Country } from '@/types/geography.types';

type Question = 'lastName' | 'firstName' | 'country' | 'phone';
const QUESTIONS: Question[] = ['lastName', 'firstName', 'country', 'phone'];

const COPY: Record<Question, { title: string; subtitle: string; label: string }> = {
  lastName: { title: 'Votre nom', subtitle: 'Quel est votre nom de famille ?', label: 'Votre nom' },
  firstName: { title: 'Votre prénom', subtitle: 'Et comment vous appelez-vous ?', label: 'Votre prénom' },
  country: { title: 'Pays de résidence', subtitle: 'Dans quel pays habitez-vous ?', label: 'Votre pays' },
  phone: { title: 'Votre téléphone', subtitle: 'Nous vous envoyons un code par SMS pour vérifier votre numéro.', label: 'Votre téléphone' },
};

export default function SignupScreen() {
  const { accountType: accountTypeParam } = useLocalSearchParams<{ accountType?: SignupAccountType }>();
  const accountType: SignupAccountType = accountTypeParam === 'DRIVER' ? 'DRIVER' : 'CUSTOMER';
  const setSignup = useAuthFlowStore((state) => state.setSignup);

  const [index, setIndex] = useState(0);
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [country, setCountry] = useState<Country | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | undefined>();

  useDefaultSignupCountry(country, setCountry);

  const question = QUESTIONS[index]!;
  const copy = COPY[question];

  function goBack() {
    setError(undefined);
    setFormError(undefined);
    if (index === 0) router.back();
    else setIndex(index - 1);
  }

  // Retour du téléphone Android : revient à la question précédente au lieu de quitter l'inscription.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (index === 0) return false;
      setError(undefined);
      setFormError(undefined);
      setIndex((current) => current - 1);
      return true;
    });
    return () => subscription.remove();
  }, [index]);

  const sendCode = useMutation({
    mutationFn: (international: string) => authApi.signupPhone({ phone: international, accountType }),
    onSuccess: (_result, international) => {
      setSignup({ accountType, lastName: lastName.trim(), firstName: firstName.trim(), country, phone: international });
      router.push('/(auth)/verify-otp');
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.');
    },
  });

  function handleContinue() {
    setError(undefined);
    setFormError(undefined);
    if (question === 'lastName') {
      if (lastName.trim().length < 2) return setError('Indiquez votre nom.');
      setIndex(1);
    } else if (question === 'firstName') {
      if (firstName.trim().length < 2) return setError('Indiquez votre prénom.');
      setIndex(2);
    } else if (question === 'country') {
      if (!country) return setError('Choisissez votre pays de résidence.');
      setIndex(3);
    } else {
      const international = buildInternationalPhone(country?.phoneCode ?? '', phone);
      if (!country || !isValidPhoneNumber(international)) return setError('Numéro invalide. Vérifiez-le sans l’indicatif du pays.');
      sendCode.mutate(international);
    }
  }

  const icon =
    question === 'phone' ? (
      <IconPhone size={26} color={OCEAN.onDark} />
    ) : question === 'country' ? (
      <IconFlag size={26} color={OCEAN.onDark} />
    ) : question === 'firstName' ? (
      <IconUser size={26} color={OCEAN.onDark} />
    ) : (
      <IconUserPlus size={26} color={OCEAN.onDark} />
    );

  return (
    <AuthStep
      icon={icon}
      title={copy.title}
      subtitle={copy.subtitle}
      onBack={goBack}
      step={{ current: SIGNUP_STEP[question], total: SIGNUP_STEPS, label: copy.label }}
      footer={<OceanButton label="Continuer" onPress={handleContinue} loading={sendCode.isPending} />}
    >
      {question === 'lastName' ? (
        <TextField
          key="lastName"
          label="Nom"
          value={lastName}
          onChangeText={(text) => {
            setLastName(text);
            setError(undefined);
          }}
          placeholder="Diallo"
          autoCapitalize="words"
          autoComplete="family-name"
          textContentType="familyName"
          returnKeyType="next"
          onSubmitEditing={handleContinue}
          error={error}
          autoFocus
        />
      ) : null}

      {question === 'firstName' ? (
        <TextField
          key="firstName"
          label="Prénom"
          value={firstName}
          onChangeText={(text) => {
            setFirstName(text);
            setError(undefined);
          }}
          placeholder="Fatoumata"
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="next"
          onSubmitEditing={handleContinue}
          error={error}
          autoFocus
        />
      ) : null}

      {question === 'country' ? (
        <CountryField
          label="Pays de résidence"
          value={country}
          onSelect={(next) => {
            setCountry(next);
            setError(undefined);
          }}
          error={error}
          showDialCode={false}
        />
      ) : null}

      {question === 'phone' ? (
        <PhoneField
          country={country}
          value={phone}
          onChangeText={(text) => {
            setPhone(text);
            setError(undefined);
          }}
          error={error}
          autoFocus
        />
      ) : null}

      {formError ? <FeedbackBanner tone="error" text={formError} onDismiss={() => setFormError(undefined)} /> : null}

      {index === 0 ? (
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
      ) : null}
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  already: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.lg },
});
