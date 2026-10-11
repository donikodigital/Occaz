// mobile/app/(auth)/signup-email.tsx
// [11/10/2026] v1 — Création de compte, étape 3 : l'adresse e-mail, FACULTATIVE. On explique d'abord ce qu'elle apporte (mot de passe oublié,
// billets et reçus, suivi des colis, messages importants). « Recevoir le code » envoie un code à 6 chiffres à cette adresse pour la
// vérifier ; « Passer cette étape » mène directement au mot de passe.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconBell, IconKey, IconMail, IconPackage, IconTicket } from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { OceanButton, OceanCard } from '@/components/ocean/OceanKit';
import { AuthStep } from '@/components/auth/AuthStep';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { SIGNUP_STEP, SIGNUP_STEPS } from '@/components/auth/signupSteps';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const BENEFITS = [
  { icon: IconKey, text: 'Retrouver votre compte si vous oubliez votre mot de passe' },
  { icon: IconTicket, text: 'Recevoir vos billets et reçus de paiement' },
  { icon: IconPackage, text: 'Suivre vos colis étape par étape' },
  { icon: IconBell, text: 'Ne manquer aucun message important de vos conducteurs ou clients' },
];

export default function SignupEmailScreen() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();

  const sendCode = useMutation({
    mutationFn: (address: string) => authApi.requestEmailCode(address),
    onSuccess: (_result, address) => {
      router.push({ pathname: '/(auth)/signup-email-code', params: { email: address } });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Une erreur est survenue. Réessayez.'),
  });

  function handleSend() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError('Adresse e-mail invalide.');
      return;
    }
    setError(undefined);
    sendCode.mutate(address);
  }

  return (
    <AuthStep
      icon={<IconMail size={26} color={OCEAN.onDark} />}
      title="Votre adresse e-mail"
      subtitle="Facultatif, mais très utile."
      step={{ current: SIGNUP_STEP.email, total: SIGNUP_STEPS, label: 'E-mail (facultatif)' }}
      footer={
        <View style={styles.footer}>
          <OceanButton label="Recevoir le code" onPress={handleSend} loading={sendCode.isPending} />
          <Pressable
            onPress={() => router.replace('/(auth)/signup-password')}
            accessibilityRole="button"
            hitSlop={8}
            style={styles.skip}
          >
            <AppText variant="sm" weight="semibold" color={OCEAN.base}>
              Passer cette étape
            </AppText>
          </Pressable>
        </View>
      }
    >
      <OceanCard style={styles.benefits}>
        <AppText variant="sm" weight="semibold" color={OCEAN.deep} style={styles.benefitsTitle}>
          Avec une adresse e-mail, vous pouvez :
        </AppText>
        {BENEFITS.map(({ icon: Icon, text }) => (
          <View key={text} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Icon size={16} color={OCEAN.base} />
            </View>
            <AppText variant="sm" color="textSecondary" style={styles.benefitText}>
              {text}
            </AppText>
          </View>
        ))}
      </OceanCard>

      <TextField
        label="Adresse e-mail"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setError(undefined);
        }}
        placeholder="vous@exemple.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        error={error}
      />
      <AppText variant="xs" color="textMuted">
        Un code à 6 chiffres sera envoyé à cette adresse pour la vérifier. Vous pourrez l’ajouter plus tard depuis votre profil.
      </AppText>
    </AuthStep>
  );
}

const styles = StyleSheet.create({
  benefits: { marginBottom: spacing.lg, gap: spacing.sm },
  benefitsTitle: { marginBottom: spacing.xxs },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: { flex: 1 },
  footer: { gap: spacing.xs },
  skip: { alignItems: 'center', paddingVertical: spacing.xs },
});
