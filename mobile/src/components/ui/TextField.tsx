// mobile/src/components/ui/TextField.tsx
import React, { useState } from 'react';
import {
  TextInput,
  TextInputProps,
  StyleSheet,
  View,
  Pressable,
} from 'react-native';
import { IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { AppText } from './AppText';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  /** Affiche un bouton œil pour basculer la visibilité — n'a d'effet qu'avec secureTextEntry. */
  toggleableSecureEntry?: boolean;
}

/**
 * Champ de saisie unique pour toute l'app. `error` bascule la bordure
 * en rouge et affiche le message sous le champ — jamais de validation
 * silencieuse.
 */
export function TextField({
  label,
  error,
  leftIcon,
  secureTextEntry,
  toggleableSecureEntry = false,
  style,
  ...rest
}: TextFieldProps) {
  const [isSecureVisible, setSecureVisible] = useState(false);
  const effectiveSecureEntry = secureTextEntry && !isSecureVisible;

  return (
    <View style={styles.container}>
      {label ? (
        <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          { borderColor: error ? colors.danger : colors.border },
        ]}
      >
        {leftIcon}
        <TextInput
          style={[styles.input, style]}
          placeholderTextColor={colors.textMuted}
          secureTextEntry={effectiveSecureEntry}
          {...rest}
        />
        {secureTextEntry && toggleableSecureEntry ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isSecureVisible ? 'Masquer' : 'Afficher'}
            onPress={() => setSecureVisible((v) => !v)}
            hitSlop={8}
          >
            {isSecureVisible ? (
              <IconEyeOff size={18} color={colors.textSecondary} />
            ) : (
              <IconEye size={18} color={colors.textSecondary} />
            )}
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="xs" color="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    marginBottom: spacing.xxs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    minHeight: 52,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    paddingVertical: spacing.xs,
  },
  error: {
    marginTop: spacing.xxs,
  },
});
