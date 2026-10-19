// mobile/src/components/screens/AddEmailReminderCard.tsx
// [19/10/2026] v1 — Rappel d'ajouter une adresse e-mail (facultative, mais utile : mot de passe oublié, reçus, suivi des colis).
// Affiché sur l'accueil (client et conducteur) et dans le menu du profil tant que le compte n'a pas d'adresse vérifiée. Complète l'étape
// facultative de l'inscription et les rappels envoyés par notification (1 jour puis 5 jours après la création du compte).
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronRight, IconMail } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAuthStore } from '@/stores/authStore';
import type { Space } from '@/types/roles.types';

export function AddEmailReminderCard({ space }: { space: Space }) {
  const hasEmail = useAuthStore((state) => Boolean(state.user?.email));
  const isReady = useAuthStore((state) => state.isAuthenticated && !state.user?.mustSetPassword);
  if (hasEmail || !isReady) return null;

  return (
    <Pressable
      onPress={() => router.push(space === 'DRIVER' ? '/(driver)/add-email' : '/(customer)/add-email')}
      accessibilityRole="button"
      accessibilityLabel="Ajouter mon adresse e-mail"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.icon}>
        <IconMail size={18} color={OCEAN.base} />
      </View>
      <View style={styles.text}>
        <AppText variant="sm" weight="bold" color={OCEAN.deep}>
          Ajoutez votre adresse e-mail
        </AppText>
        <AppText variant="xs" color="textSecondary">
          Facultatif, mais utile : retrouver votre compte, recevoir vos reçus et ne manquer aucun message important.
        </AppText>
      </View>
      <IconChevronRight size={16} color={OCEAN.base} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: OCEAN.line,
    backgroundColor: OCEAN.mist,
    marginBottom: spacing.lg,
  },
  pressed: { opacity: 0.8 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
