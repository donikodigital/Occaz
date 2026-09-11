// mobile/src/components/ui/IconButton.tsx
import React from 'react';
import { Pressable, PressableProps, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';

export interface IconButtonProps extends Omit<PressableProps, 'style'> {
  icon: React.ReactNode;
  variant?: 'filled' | 'outline';
  accessibilityLabel: string;
  size?: number;
}

/** Bouton carré icône seule — retour, notifications, filtres. `accessibilityLabel` est obligatoire (pas de texte visible). */
export function IconButton({
  icon,
  variant = 'outline',
  size = 38,
  ...rest
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.base,
        {
          width: size,
          height: size,
          backgroundColor: variant === 'filled' ? colors.surfaceMuted : colors.surface,
          borderWidth: variant === 'outline' ? 1.5 : 0,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
      {...rest}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.sm + 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
