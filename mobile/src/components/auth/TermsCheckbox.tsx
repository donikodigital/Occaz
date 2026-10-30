// mobile/src/components/auth/TermsCheckbox.tsx
// [30/10/2026] v1 — Case « J'ai lu et j'accepte les conditions d'utilisation et la politique de confidentialité », obligatoire avant la
// création d'un compte Client ou Conducteur. Les deux textes s'ouvrent sur le site (les écrans de l'application ne sont accessibles
// qu'une fois connecté) ; l'acceptation (date et version) est gardée sur le compte par l'API.
import React from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { IconCheck } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { COMPANY } from '@/content/legal';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT } from '@/i18n';

interface TermsCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** La personne a essayé de continuer sans cocher : la case se signale. */
  hasError?: boolean;
}

function open(url: string) {
  void Linking.openURL(url).catch(() => undefined);
}

export function TermsCheckbox({ checked, onChange, hasError = false }: TermsCheckboxProps) {
  const t = useT();
  return (
    <View style={[styles.row, hasError && !checked && styles.rowError]}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={t('J’ai lu et j’accepte les conditions d’utilisation et la politique de confidentialité')}
        hitSlop={8}
        style={[styles.box, checked && styles.boxChecked, hasError && !checked && styles.boxError]}
      >
        {checked ? <IconCheck size={16} color={OCEAN.onDark} /> : null}
      </Pressable>
      <AppText variant="sm" color="textSecondary" style={styles.text} onPress={() => onChange(!checked)}>
        {t('J’ai lu et j’accepte les')}{' '}
        <AppText variant="sm" weight="semibold" color={OCEAN.base} onPress={() => open(COMPANY.termsUrl)} accessibilityRole="link">
          {t('conditions d’utilisation')}
        </AppText>{' '}
        {t('et la')}{' '}
        <AppText variant="sm" weight="semibold" color={OCEAN.base} onPress={() => open(COMPANY.privacyUrl)} accessibilityRole="link">
          {t('politique de confidentialité')}
        </AppText>
        .
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    marginTop: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: OCEAN.mist,
    borderWidth: 1,
    borderColor: OCEAN.line,
  },
  rowError: { borderColor: colors.danger },
  box: {
    width: 24,
    height: 24,
    marginTop: 1,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: OCEAN.base,
    backgroundColor: OCEAN.onDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: OCEAN.base },
  boxError: { borderColor: colors.danger },
  text: { flex: 1 },
});
