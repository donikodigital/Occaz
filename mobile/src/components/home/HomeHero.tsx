// mobile/src/components/home/HomeHero.tsx
//
// [08/10/2026] v1 — Haut de l'accueil, refait d'après la maquette : un grand bandeau bleu océan aux bords bas arrondis (avatar avec sa
// coche de vérification, salutation, nom et sceau « profil vérifié », cloche), et par-dessus, à cheval sur le bas du bandeau, la carte
// blanche « MON TABLEAU DE BORD » (un chiffre principal à gauche, deux statistiques à droite).
// Le bandeau passe sous la barre d'état (le parent doit donc utiliser ScreenContainer avec edges={['bottom']}).
// Commun aux deux espaces : seul le contenu (solde, libellés, chiffres) change.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconBell, IconCheck, IconRosetteDiscountCheckFilled } from '@tabler/icons-react-native';
import { AppText, Avatar } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

const AVATAR_SIZE = 54;
const BELL_SIZE = 44;
/** De combien la carte du tableau de bord remonte sur le bandeau. */
const OVERLAP = 56;

function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours();
  return hour >= 18 || hour < 5 ? 'Bonsoir' : 'Bonjour';
}

export interface HomeHeroProps {
  firstName?: string;
  lastName?: string;
  initials: string;
  photoUri?: string | null;
  /** Profil validé : coche verte sur l'avatar et sceau doré à côté du nom. */
  isVerified?: boolean;
  unreadCount: number;
  onPressAvatar: () => void;
  onPressNotifications: () => void;
}

export function HomeHero({
  firstName,
  lastName,
  initials,
  photoUri,
  isVerified = false,
  unreadCount,
  onPressAvatar,
  onPressNotifications,
}: HomeHeroProps) {
  const insets = useSafeAreaInsets();

  // Le bandeau passe sous la barre d'état : icônes claires tant que l'accueil est à l'écran, rétablies en le quittant.
  useFocusEffect(
    React.useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const bellLabel = unreadCount > 0 ? `Notifications, ${unreadCount} non lues` : 'Notifications';
  const fullName = [firstName, lastName].filter(Boolean).join(' ') || '…';

  return (
    <View style={[styles.hero, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.circleLarge} />
      <View style={styles.circleSmall} />

      <View style={styles.row}>
        <Pressable
          onPress={onPressAvatar}
          accessibilityRole="button"
          accessibilityLabel="Voir mon profil"
          style={({ pressed }) => [styles.identity, pressed && styles.pressed]}
        >
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <Avatar initials={initials} imageUri={photoUri} size={AVATAR_SIZE} backgroundColor={OCEAN.bright} />
            </View>
            {isVerified ? (
              <View style={styles.verifiedDot}>
                <IconCheck size={10} color={colors.onSuccess} strokeWidth={3} />
              </View>
            ) : null}
          </View>

          <View style={styles.greeting}>
            <AppText variant="sm" color={OCEAN.sky}>
              {getGreeting()}
            </AppText>
            <View style={styles.nameRow}>
              <AppText variant="lg" weight="bold" color={OCEAN.onDark} numberOfLines={1} style={styles.name}>
                {fullName}
              </AppText>
              {isVerified ? <IconRosetteDiscountCheckFilled size={20} color={OCEAN.gold} /> : null}
            </View>
          </View>
        </Pressable>

        <View>
          <Pressable
            onPress={onPressNotifications}
            accessibilityRole="button"
            accessibilityLabel={bellLabel}
            style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
          >
            <IconBell size={21} color={OCEAN.onDark} />
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
    </View>
  );
}

// ---------------------------------------------------------------------------
// Carte « Mon tableau de bord »
// ---------------------------------------------------------------------------

export interface DashboardMainFigure {
  label: string;
  value: string;
  /** Petite ligne sous le chiffre (« Disponible », « 2 en attente »…). */
  hint?: string;
  onPress?: () => void;
}

export interface DashboardStat {
  label: string;
  value: string;
}

export function DashboardCard({
  title = 'Mon tableau de bord',
  main,
  statsTitle = 'Statistiques',
  stats,
}: {
  title?: string;
  main: DashboardMainFigure;
  statsTitle?: string;
  stats: DashboardStat[];
}) {
  const mainContent = (
    <>
      <AppText variant="xs" color="textSecondary">
        {main.label}
      </AppText>
      <AppText variant="xl" weight="bold" color={OCEAN.deep} numberOfLines={1} adjustsFontSizeToFit>
        {main.value}
      </AppText>
      {main.hint ? (
        <AppText variant="xs" color="textMuted" numberOfLines={1}>
          {main.hint}
        </AppText>
      ) : null}
    </>
  );

  return (
    <View style={styles.dashboard}>
      <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.dashboardTitle}>
        {title.toUpperCase()}
      </AppText>
      <View style={styles.dashboardBody}>
        {main.onPress ? (
          <Pressable
            onPress={main.onPress}
            accessibilityRole="button"
            accessibilityLabel={`${main.label} : ${main.value}`}
            style={({ pressed }) => [styles.mainFigure, pressed && styles.pressed]}
          >
            {mainContent}
          </Pressable>
        ) : (
          <View style={styles.mainFigure}>{mainContent}</View>
        )}

        <View style={styles.divider} />

        <View style={styles.statsBlock}>
          <AppText variant="xs" color="textSecondary">
            {statsTitle}
          </AppText>
          <View style={styles.statsRow}>
            {stats.map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <AppText variant="xl" weight="bold" color={OCEAN.deep}>
                  {stat.value}
                </AppText>
                <AppText variant="xs" color="textSecondary" numberOfLines={1}>
                  {stat.label}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  hero: {
    backgroundColor: OCEAN.deep,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    paddingHorizontal: spacing.lg,
    paddingBottom: OVERLAP + spacing.md,
    overflow: 'hidden',
  },
  circleLarge: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 230,
    height: 230,
    borderRadius: 115,
    backgroundColor: 'rgba(30,155,215,0.28)',
  },
  circleSmall: {
    position: 'absolute',
    bottom: -40,
    left: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(143,211,244,0.14)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarWrap: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
  },
  avatarRing: {
    width: AVATAR_SIZE + 6,
    height: AVATAR_SIZE + 6,
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedDot: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.success,
    borderWidth: 2,
    borderColor: OCEAN.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  greeting: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
  },
  bell: {
    width: BELL_SIZE,
    height: BELL_SIZE,
    borderRadius: BELL_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
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
    borderColor: OCEAN.deep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 12,
  },

  dashboard: {
    marginHorizontal: spacing.lg,
    marginTop: -OVERLAP,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: OCEAN.line,
    padding: spacing.md,
    gap: spacing.sm,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
  dashboardTitle: {
    letterSpacing: 1,
  },
  dashboardBody: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.md,
  },
  mainFigure: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  divider: {
    width: 1,
    backgroundColor: OCEAN.line,
  },
  statsBlock: {
    flex: 1.15,
    gap: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
  },
});
