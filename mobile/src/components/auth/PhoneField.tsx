// mobile/src/components/auth/PhoneField.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [11/10/2026] v1 — Champ téléphone : pastille « 🇬🇳 +224 » (indicatif du pays choisi) suivie du numéro sans indicatif. Si `onPressCountry`
// est fourni, la pastille ouvre la liste des pays ; sinon l'indicatif suit le pays choisi plus haut sur l'écran (inscription).
// Les espaces sont insérés pendant la frappe selon le pays (utils/phone.ts). Un numéro collé avec son indicatif est ramené à sa partie
// nationale ; celui d'un autre pays (« +33612345678 ») est accepté tel quel.
import React from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { IconChevronDown } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, fontFamily, fontSize, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { flagEmoji, formatDialCode, formatPhoneTyping, phonePlaceholder } from '@/utils/phone';
import type { Country } from '@/types/geography.types';
import { useT, translate } from '@/i18n';

export function PhoneField({
  label = translate('Téléphone'),
  country,
  value,
  onChangeText,
  onPressCountry,
  error,
  autoFocus,
}: {
  label?: string;
  country: Country | null;
  value: string;
  onChangeText: (text: string) => void;
  onPressCountry?: () => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const t = useT();
  const chip = (
    <>
      <AppText variant="lg">{country ? flagEmoji(country.isoCode) : '🌍'}</AppText>
      <AppText variant="base" weight="semibold" color={OCEAN.deep}>
        {country ? formatDialCode(country.phoneCode) : '+'}
      </AppText>
      {onPressCountry ? <IconChevronDown size={14} color={colors.textSecondary} /> : null}
    </>
  );

  return (
    <View style={styles.wrap}>
      <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <View style={[styles.field, error ? styles.fieldError : null]}>
        {onPressCountry ? (
          <Pressable onPress={onPressCountry} accessibilityRole="button" accessibilityLabel={t('Changer de pays')} style={styles.chip}>
            {chip}
          </Pressable>
        ) : (
          <View style={styles.chip}>{chip}</View>
        )}
        <TextInput
          value={value}
          // Les espaces sont posés au fil de la frappe, selon le pays (Guinée : 622 34 32 34 ; Sénégal : 77 509 99 95).
          onChangeText={(text) => onChangeText(formatPhoneTyping(country, text))}
          placeholder={phonePlaceholder(country?.isoCode)}
          placeholderTextColor={colors.textMuted}
          keyboardType="phone-pad"
          autoComplete="tel-national"
          textContentType="telephoneNumber"
          autoFocus={autoFocus}
          style={styles.input}
          accessibilityLabel={label}
        />
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
  wrap: { marginBottom: spacing.md },
  label: { marginBottom: spacing.xxs },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 52,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  fieldError: { borderColor: colors.danger },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    alignSelf: 'stretch',
    // Ne se rétrécit jamais : sans cela, le champ de saisie (largeur propre sur le web) écrasait « 🇬🇳 +224 ».
    flexShrink: 0,
    backgroundColor: OCEAN.mist,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.medium,
    fontSize: fontSize.md,
    color: colors.textPrimary,
    // Pas de cadre noir du navigateur : c'est le contour du champ entier qui sert de repère.
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  error: { marginTop: spacing.xxs },
});
