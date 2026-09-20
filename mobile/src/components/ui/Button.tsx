// mobile/src/components/ui/Button.tsx
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableProps,
  StyleSheet,
  View,
} from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { AppText } from './AppText';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends PressableProps {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_STYLES: Record<
  ButtonVariant,
  { background: string; text: string; border?: string }
> = {
  primary: { background: colors.primary, text: colors.onPrimary },
  success: { background: colors.success, text: colors.onSuccess },
  danger: { background: colors.danger, text: colors.onDanger },
  secondary: { background: colors.surface, text: colors.textPrimary, border: colors.border },
  outline: { background: 'transparent', text: colors.primary, border: colors.primary },
  ghost: { background: 'transparent', text: colors.textPrimary },
};

/**
 * Bouton unique pour toute l'app. Une seule action "primary" par écran
 * (cohérent avec la hiérarchie visuelle des maquettes) — les actions
 * secondaires utilisent "secondary" ou "outline".
 *
 * Correctif : `style` était extrait des props mais jamais appliqué, donc
 * toutes les marges passées par les écrans (`style={styles.submit}`…)
 * étaient ignorées. Il est maintenant appliqué en dernier, il peut donc
 * aussi surcharger le style de base (objet, tableau ou fonction `({ pressed })`).
 */
export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  loading = false,
  fullWidth = true,
  leftIcon,
  rightIcon,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const variantStyle = VARIANT_STYLES[variant];
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      style={(state) => [
        styles.base,
        size === 'lg' ? styles.lg : styles.md,
        {
          backgroundColor: variantStyle.background,
          borderColor: variantStyle.border ?? 'transparent',
          borderWidth: variantStyle.border ? 1.5 : 0,
          opacity: isDisabled ? 0.5 : state.pressed ? 0.85 : 1,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
        },
        typeof style === 'function' ? style(state) : style,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variantStyle.text} />
      ) : (
        <View style={styles.content}>
          {leftIcon}
          <AppText variant={size === 'lg' ? 'md' : 'base'} weight="semibold" color={variantStyle.text}>
            {label}
          </AppText>
          {rightIcon}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lg: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  md: {
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});