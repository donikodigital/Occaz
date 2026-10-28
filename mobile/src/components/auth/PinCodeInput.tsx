// mobile/src/components/auth/PinCodeInput.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [11/10/2026] v1 — Saisie du mot de passe à 6 chiffres : six cases, chiffres masqués (•) avec un bouton « Afficher ». Un champ caché reçoit la
// frappe (clavier numérique, sans suggestion ni mémorisation par le clavier) ; toucher les cases ramène le clavier. `onComplete` est
// appelé dès que les 6 chiffres sont saisis, avec le code en paramètre.
import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { IconEye, IconEyeOff } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT } from '@/i18n';

export const PIN_LENGTH = 6;

export function PinCodeInput({
  label,
  value,
  onChange,
  onComplete,
  hasError,
  autoFocus = true,
}: {
  label?: string;
  value: string;
  onChange: (pin: string) => void;
  onComplete?: (pin: string) => void;
  hasError?: boolean;
  autoFocus?: boolean;
}) {
  const t = useT();
  const inputRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [revealed, setRevealed] = useState(false);

  function handleChange(text: string) {
    const digits = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    onChange(digits);
    if (digits.length === PIN_LENGTH) onComplete?.(digits);
  }

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
          {label}
        </AppText>
      ) : null}
      <Pressable onPress={() => inputRef.current?.focus()} style={styles.row} accessibilityLabel={label ?? t('Mot de passe à 6 chiffres')}>
        {Array.from({ length: PIN_LENGTH }).map((_, index) => {
          const digit = value[index];
          return (
            <View
              key={index}
              style={[
                styles.box,
                {
                  borderColor: hasError ? colors.danger : value.length === index ? OCEAN.base : colors.border,
                  backgroundColor: digit !== undefined ? OCEAN.mist : colors.surface,
                },
              ]}
            >
              <AppText variant="xl" weight="semibold" color={OCEAN.deep}>
                {digit === undefined ? '' : revealed ? digit : '•'}
              </AppText>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={PIN_LENGTH}
        autoFocus={autoFocus}
        secureTextEntry
        autoComplete="off"
        importantForAutofill="no"
        style={styles.hidden}
      />
      <Pressable
        onPress={() => setRevealed((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={revealed ? t('Masquer le mot de passe') : t('Afficher le mot de passe')}
        hitSlop={8}
        style={styles.reveal}
      >
        {revealed ? <IconEyeOff size={16} color={OCEAN.base} /> : <IconEye size={16} color={OCEAN.base} />}
        <AppText variant="xs" weight="semibold" color={OCEAN.base}>
          {revealed ? t('Masquer') : t('Afficher')}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xs, textAlign: 'center' },
  row: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  box: { width: 46, height: 56, borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  reveal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing.sm, alignSelf: 'center' },
});
