// mobile/src/components/ui/HoverCard.tsx
//
// Variante de Card avec une légère animation au survol (agrandissement +
// ombre portée) — ne réagit que sur les plateformes qui déclenchent
// onHoverIn/onHoverOut (web/desktop via react-native-web). Sur mobile
// tactile natif, ces événements ne se déclenchent jamais : le rendu et le
// comportement restent identiques à Card, donc aucune régression en
// l'utilisant à la place de Card dans un écran existant.
//
// Fichier isolé — Card.tsx n'est pas modifié, ses usages actuels ailleurs
// dans l'app ne sont pas affectés.

import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, ViewProps } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export interface HoverCardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
}

export function HoverCard({ onPress, padded = true, style, children, ...rest }: HoverCardProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const shadowOpacity = useRef(new Animated.Value(0)).current;

  function animateHover(isHovering: boolean) {
    Animated.timing(scale, {
      toValue: isHovering ? 1.02 : 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    Animated.timing(shadowOpacity, {
      toValue: isHovering ? 0.15 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }

  const content = (
    <Animated.View
      style={[styles.base, padded && styles.padded, { transform: [{ scale }], shadowOpacity }, style]}
      {...rest}
    >
      {children}
    </Animated.View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => animateHover(true)}
      onHoverOut={() => animateHover(false)}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 2,
  },
  padded: {
    padding: spacing.md,
  },
});