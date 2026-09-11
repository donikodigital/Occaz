// mobile/src/components/ui/Card.tsx
import React from 'react';
import { Pressable, StyleSheet, View, ViewProps } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  padded?: boolean;
}

/** Conteneur blanc à bordure fine — l'unité de base de toute liste ou fiche. */
export function Card({ onPress, padded = true, style, children, ...rest }: CardProps) {
  const content = (
    <View style={[styles.base, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
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
  },
  padded: {
    padding: spacing.md,
  },
});
