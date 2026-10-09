// mobile/src/components/screens/ShipmentInvitationBanner.tsx
// [09/10/2026] v1 — bannière clignotante de l'accueil conducteur : « un client vous invite à prendre son colis ».
//
// Même famille que MessageAlertCard (halo qui pulse) mais plus voyante : toute la carte respire (opacité) pour qu'on ne la rate pas.
// Une seule bannière, quel que soit le nombre d'invitations : elle ouvre l'écran des invitations.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { IconChevronRight, IconPackage } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function ShipmentInvitationBanner({
  count,
  destinationCity,
  onPress,
}: {
  count: number;
  /** Ville d'arrivée de la première invitation, pour dire de quel colis il s'agit. */
  destinationCity?: string;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const title = count > 1 ? `${count} clients vous invitent` : 'Un client vous invite';
  const subtitle = count > 1 ? 'Ils vous demandent de prendre leur colis' : destinationCity ? `Colis à destination de ${destinationCity}` : 'Il vous demande de prendre son colis';

  return (
    <Animated.View style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }) }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${subtitle}. Ouvrir.`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.iconWrap}>
          <Animated.View
            style={[
              styles.halo,
              {
                opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
                transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
              },
            ]}
          />
          <View style={styles.icon}>
            <IconPackage size={20} color={colors.onAccent} />
          </View>
        </View>
        <View style={styles.text}>
          <AppText variant="base" weight="bold" color={colors.onAccent} numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="xs" color={colors.onAccent} numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </AppText>
        </View>
        <IconChevronRight size={20} color={colors.onAccent} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  pressed: { opacity: 0.85 },
  iconWrap: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: 42, height: 42, borderRadius: 21, backgroundColor: colors.onAccent },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(65, 36, 2, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  subtitle: { opacity: 0.85 },
});
