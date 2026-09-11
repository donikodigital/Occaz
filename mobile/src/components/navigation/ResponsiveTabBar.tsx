// mobile/src/components/navigation/ResponsiveTabBar.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { AppText } from '@/components/ui';
import { colors, radius, sidebarWidth, spacing } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface ResponsiveTabBarProps extends BottomTabBarProps {
  /** Couleur d'accent de cet espace (indigo côté client, émeraude côté chauffeur) — distingue les deux d'un coup d'œil sur desktop. */
  accentColor: string;
  /** Nom affiché en haut de la barre latérale desktop (ex: "Espace client"). */
  brandLabel: string;
}

/**
 * Un seul composant, deux rendus, un seul état de navigation. En
 * dessous du seuil desktop, se comporte exactement comme une barre
 * d'onglets classique en bas d'écran — rien ne change pour l'usage
 * mobile natif. Au-delà, la même liste d'onglets devient une barre
 * latérale fixe à gauche, le motif standard des applications de
 * gestion sur grand écran.
 */
export function ResponsiveTabBar({ state, descriptors, navigation, accentColor, brandLabel }: ResponsiveTabBarProps) {
  const { isDesktop } = useResponsive();

  const items = state.routes.map((route, index) => {
    const { options } = descriptors[route.key];
    const isFocused = state.index === index;
    const label = typeof options.title === 'string' ? options.title : route.name;
    const iconColor = isFocused ? accentColor : colors.textMuted;
    const icon = options.tabBarIcon?.({ focused: isFocused, color: iconColor, size: isDesktop ? 20 : 22 });

    function handlePress() {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name);
      }
    }

    return { key: route.key, label, icon, isFocused, handlePress };
  });

  if (isDesktop) {
    return (
      <SafeAreaView edges={['top', 'bottom', 'left']} style={styles.sidebarSafeArea}>
        <View style={styles.sidebar}>
          <AppText variant="lg" weight="bold" color={accentColor} style={styles.brand}>
            {brandLabel}
          </AppText>
          {items.map((item) => (
            <Pressable
              key={item.key}
              onPress={item.handlePress}
              style={[styles.sidebarItem, item.isFocused && { backgroundColor: `${accentColor}1A` }]}
            >
              {item.icon}
              <AppText
                variant="base"
                weight={item.isFocused ? 'semibold' : 'regular'}
                color={item.isFocused ? accentColor : 'textPrimary'}
              >
                {item.label}
              </AppText>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.bottomSafeArea}>
      <View style={styles.bottomBar}>
        {items.map((item) => (
          <Pressable key={item.key} onPress={item.handlePress} style={styles.bottomItem}>
            {item.icon}
            <AppText variant="xs" weight="medium" color={item.isFocused ? accentColor : 'textMuted'}>
              {item.label}
            </AppText>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // --- Barre basse (mobile / tablette) ---
  bottomSafeArea: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxs,
  },
  bottomItem: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xxs,
    minWidth: 56,
  },
  // --- Barre latérale (desktop) ---
  sidebarSafeArea: {
    backgroundColor: colors.surface,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  sidebar: {
    width: sidebarWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    gap: spacing.xxs,
  },
  brand: {
    marginBottom: spacing.lg,
    marginLeft: spacing.sm,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
  },
});
