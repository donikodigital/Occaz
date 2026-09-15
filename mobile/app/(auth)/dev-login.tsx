// mobile/app/(auth)/dev-login.tsx
//
// Écran de secours strictement pour le développement : rejoue le flux
// OTP (requestOtp + verifyOtp) avec un numéro de test connu, sans passer
// par la saisie manuelle de l'écran verify-otp. Sert à 1) débloquer une
// session de travail tant que le bug réseau sur /otp/verify n'est pas
// identifié, et 2) isoler si le problème vient de la saisie (otp boxes /
// hidden input) ou d'un souci plus profond — ici c'est le même appel
// réseau, déclenché sans passer par le clavier.
//
// Fichier isolé, ne touche à rien d'existant. Accessible uniquement en
// __DEV__. Route : /(auth)/dev-login
//   - En web (Expo web) : ouvre juste http://localhost:8081/(auth)/dev-login
//   - Sur device/simulateur : depuis le menu dev / debugger distant,
//     exécute `require('expo-router').router.push('/(auth)/dev-login')`
//     — ou ajoute temporairement un `router.push('/(auth)/dev-login')`
//     dans login.tsx le temps du test, à retirer ensuite.

import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { AppText, Button, ScreenContainer, TextField } from '@/components/ui';
import { spacing } from '@/theme';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { useAuthStore } from '@/stores/authStore';

const DEFAULT_TEST_PHONE = '+224600000001';
const DEFAULT_TEST_CODE = '000000';

export default function DevLoginScreen() {
  const [phone, setPhone] = useState(DEFAULT_TEST_PHONE);
  const [status, setStatus] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  if (!__DEV__) {
    return (
      <ScreenContainer maxWidth="form">
        <AppText variant="base">Écran indisponible.</AppText>
      </ScreenContainer>
    );
  }

  async function runQuickLogin() {
    setBusy(true);
    setStatus('Envoi de la demande de code...');
    try {
      await authApi.requestOtp({ phone });
      setStatus('Code demandé, vérification...');
      const result = await authApi.verifyOtp({
        phone,
        code: DEFAULT_TEST_CODE,
        device: { platform: 'ios' },
      });
      setStatus('Connecté.');
      await setSession(result);
      router.replace(result.user.accountType === 'DRIVER' ? '/(driver)/home' : '/(customer)/(tabs)/home');
    } catch (error) {
      setStatus(
        error instanceof ApiError
          ? `Échec (${error.status ?? '?'}) : ${error.message}`
          : `Échec inattendu : ${String(error)}`,
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScreenContainer maxWidth="form">
      <View style={styles.body}>
        <AppText variant="xxl" weight="semibold" style={styles.title}>
          Connexion rapide (dev)
        </AppText>
        <AppText variant="base" color="textSecondary" style={styles.subtitle}>
          Rejoue requestOtp + verifyOtp sans passer par la saisie manuelle.
        </AppText>

        <TextField
          label="Téléphone de test"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Button
          label={busy ? 'En cours...' : 'Lancer'}
          onPress={runQuickLogin}
          loading={busy}
          style={styles.submit}
        />

        {status ? (
          <AppText
            variant="sm"
            color={status.startsWith('Échec') ? 'danger' : 'textSecondary'}
            style={styles.status}
          >
            {status}
          </AppText>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
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
  submit: {
    marginTop: spacing.lg,
  },
  status: {
    marginTop: spacing.md,
  },
});