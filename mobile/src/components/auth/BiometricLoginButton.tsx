// mobile/src/components/auth/BiometricLoginButton.tsx
// [30/10/2026] v+ — téléphone inconnu d'un compte qui a des téléphones de confiance : l'écran du code s'ouvre.
// [30/10/2026] v1 — « Se connecter avec l'empreinte » : carte affichée sur l'accueil et sur l'écran de connexion quand l'empreinte est active
// sur ce téléphone. Un appui ouvre la vérification du téléphone ; en cas de succès l'espace ouvert en dernier s'ouvre. Sur l'accueil, la
// vérification se lance toute seule à l'ouverture (une fois) pour que la reconnexion tienne en un geste.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconFaceId, IconFingerprint } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useBiometricStore } from '@/stores/biometricStore';
import { HOME_HREF } from '@/utils/spaces';
import { consumeBiometricAutoPrompt } from '@/utils/biometricAutoPrompt';
import { useT } from '@/i18n';

export function BiometricLoginButton({ autoPrompt = false }: { autoPrompt?: boolean }) {
  const t = useT();
  const record = useBiometricStore((state) => state.record);
  const capability = useBiometricStore((state) => state.capability);
  const isLoaded = useBiometricStore((state) => state.isLoaded);
  const login = useBiometricStore((state) => state.login);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const prompted = useRef(false);

  const run = useCallback(async () => {
    if (pending) return;
    setError(undefined);
    setPending(true);
    const result = await login();
    setPending(false);
    if (result.ok) {
      router.replace(HOME_HREF[result.space]);
      return;
    }
    if (result.reason === 'cancelled') return;
    if (result.reason === 'verification') {
      router.push('/(auth)/verify-device');
      return;
    }
    if (result.reason === 'lockout') setError(t('Trop d’essais. Utilisez votre mot de passe, ou réessayez dans un instant.'));
    else if (result.reason === 'expired') setError(result.message ?? t('La connexion rapide a expiré : connectez-vous avec votre mot de passe.'));
    else if (result.reason === 'network') setError(result.message ?? t('Connexion impossible — vérifiez votre réseau.'));
    else setError(result.message ?? t('Une erreur est survenue. Réessayez.'));
  }, [login, pending, t]);

  const visible = isLoaded && capability.available && Boolean(record);

  useEffect(() => {
    if (autoPrompt && visible && !prompted.current) {
      prompted.current = true;
      if (consumeBiometricAutoPrompt()) void run();
    }
  }, [autoPrompt, visible, run]);

  if (!visible || !record) return null;
  const Icon = capability.kind === 'face' ? IconFaceId : IconFingerprint;

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={run}
        disabled={pending}
        accessibilityRole="button"
        accessibilityLabel={t('Se connecter avec l’empreinte')}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.iconTile}>{pending ? <ActivityIndicator color={OCEAN.onDark} /> : <Icon size={24} color={OCEAN.onDark} />}</View>
        <View style={styles.text}>
          <AppText variant="md" weight="semibold" color={OCEAN.deep}>
            {capability.kind === 'face' ? t('Se connecter avec le visage') : t('Se connecter avec l’empreinte')}
          </AppText>
          <AppText variant="sm" color="textSecondary" numberOfLines={1}>
            {record.name ? t('Bonjour {name}', { name: record.name }) : t('Connexion rapide')}
          </AppText>
        </View>
        <IconChevronRight size={18} color={colors.textMuted} />
      </Pressable>
      {error ? <FeedbackBanner tone="error" text={error} onDismiss={() => setError(undefined)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.sm, marginBottom: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: radius.lg,
    backgroundColor: OCEAN.mist,
    borderWidth: 1,
    borderColor: OCEAN.line,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OCEAN.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 1 },
  pressed: { opacity: 0.75 },
});
