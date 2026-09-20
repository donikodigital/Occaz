// mobile/src/components/screens/HomeHeader.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconBell, IconCheck } from '@tabler/icons-react-native';
import { AppText, Avatar } from '@/components/ui';
import { colors, spacing } from '@/theme';

const AVATAR_SIZE = 48;
const BELL_SIZE = 44;

export interface HomeHeaderProps {
  /** Prénom affiché sous la salutation — "…" tant que le profil charge. */
  firstName?: string;
  /** Initiales de repli quand il n'y a pas de photo. */
  initials: string;
  photoUri?: string | null;
  /** Compte validé : affiche une petite coche verte sur l'avatar. */
  isVerified?: boolean;
  unreadCount: number;
  onPressAvatar: () => void;
  onPressNotifications: () => void;
}

function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
}

/**
 * En-tête de l'écran d'accueil : identité à gauche (avatar cliquable vers
 * le profil + salutation + prénom), cloche de notifications à droite avec
 * pastille de non-lues. Volontairement sans bouton de déconnexion — il
 * vit dans l'écran Profil.
 */
export function HomeHeader({
  firstName,
  initials,
  photoUri,
  isVerified = false,
  unreadCount,
  onPressAvatar,
  onPressNotifications,
}: HomeHeaderProps) {
  const bellLabel = unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications';

  return (
    <View style={styles.header}>
      <Pressable
        onPress={onPressAvatar}
        accessibilityRole="button"
        accessibilityLabel="Voir mon profil"
        style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
      >
        <View style={styles.avatarWrap}>
          <Avatar initials={initials} imageUri={photoUri} size={AVATAR_SIZE} />
          {isVerified ? (
            <View style={styles.verifiedDot}>
              <IconCheck size={10} color={colors.onSuccess} stroke={3} />
            </View>
          ) : null}
        </View>

        <View style={styles.greeting}>
          <AppText variant="sm" color="textSecondary">
            {getGreeting()}
          </AppText>
          <AppText variant="xl" weight="bold" numberOfLines={1}>
            {firstName ?? '…'}
          </AppText>
        </View>
      </Pressable>

      <View style={styles.bellWrapper}>
        <Pressable
          onPress={onPressNotifications}
          accessibilityRole="button"
          accessibilityLabel={bellLabel}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <IconBell size={20} color={colors.textPrimary} />
        </Pressable>
        {unreadCount > 0 ? (
          <View style={styles.badge} pointerEvents="none">
            <AppText variant="xs" weight="semibold" color={colors.onDanger} style={styles.badgeText}>
              {unreadCount > 9 ? '9+' : unreadCount}
            </AppText>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  avatarWrap: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
  },
  verifiedDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    flex: 1,
  },
  bellWrapper: {
    position: 'relative',
  },
  bell: {
    width: BELL_SIZE,
    height: BELL_SIZE,
    borderRadius: BELL_SIZE / 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 5,
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },
});