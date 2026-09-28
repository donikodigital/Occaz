// mobile/src/components/screens/MessageAlertCard.tsx
//
// Alerte "nouveau message" sur l'écran d'accueil (client et chauffeur) —
// icône avec un halo qui pulse, même famille d'animation que le point
// "En direct" de l'écran chauffeur (voir shipment-available.tsx). Une
// petite carte cliquable plutôt qu'un radar plein écran : elle doit se
// remarquer sans dominer l'écran d'accueil. Disparaît une fois ouverte —
// géré par l'appelant, qui marque la notification lue avant de naviguer.
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { IconMessageCircle } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

export function MessageAlertCard({
  senderName,
  preview,
  onPress,
}: {
  senderName: string;
  preview: string;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.out(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.in(Easing.quad),
          useNativeDriver: USE_NATIVE_DRIVER,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Nouveau message de ${senderName} : ${preview}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.iconWrap}>
        <Animated.View
          style={[
            styles.halo,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }],
            },
          ]}
        />
        <View style={styles.icon}>
          <IconMessageCircle size={19} color={colors.onAccent} />
        </View>
      </View>
      <View style={styles.text}>
        <AppText variant="sm" weight="bold" color={colors.onAccent} numberOfLines={1}>
          {senderName}
        </AppText>
        <AppText variant="xs" color={colors.onAccent} numberOfLines={1} style={styles.preview}>
          {preview}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.lg,
    padding: spacing.sm + 2,
  },
  pressed: { opacity: 0.85 },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.onAccent,
  },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(65, 36, 2, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
  preview: { opacity: 0.85 },
});