// mobile/src/components/screens/OtpCodeInput.tsx
//
// Saisie d'un code à 6 chiffres en six cases (même rendu que l'écran de connexion). Un champ caché reçoit la frappe ; toucher
// les cases ramène le clavier. `onComplete` est appelé dès que les 6 chiffres sont saisis, avec le code en paramètre.
import React, { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

export const OTP_CODE_LENGTH = 6;

export function OtpCodeInput({
  value,
  onChange,
  onComplete,
  hasError,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  hasError?: boolean;
}) {
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, OTP_CODE_LENGTH);
    onChange(digits);
    if (digits.length === OTP_CODE_LENGTH) onComplete?.(digits);
  }

  return (
    <View>
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.row} accessibilityLabel="Saisir le code à 6 chiffres">
        {Array.from({ length: OTP_CODE_LENGTH }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.box,
              {
                borderColor: hasError ? colors.danger : value.length === index ? OCEAN.base : colors.border,
                backgroundColor: value[index] !== undefined ? OCEAN.mist : colors.surface,
              },
            ]}
          >
            <AppText variant="xl" weight="semibold" color={OCEAN.deep}>
              {value[index] ?? ''}
            </AppText>
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={OTP_CODE_LENGTH}
        autoFocus
        textContentType="oneTimeCode"
        style={styles.hidden}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  box: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: {
    position: 'absolute',
    opacity: 0,
    height: 1,
    width: 1,
  },
});
