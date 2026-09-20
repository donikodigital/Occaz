// mobile/src/components/screens/LocationAutocompleteField.tsx
//
// v2 — Variante en ligne de LocationPickerScreen, utilisée dans la mise en
// page desktop de trip-new.tsx. Même parcours que l'écran mobile (voir
// useLocationPicker) : adresses mémorisées d'abord, ville détectée
// automatiquement, confirmation en une carte — mais directement dans le
// formulaire, sans changer d'écran.
//
// `basePath` et `fieldKey` sont conservés pour ne pas casser les appelants
// existants, mais ne servent plus : la ville se choisit sur place, sans
// navigation ni store global partagé entre instances.

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconMapPin, IconX } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useLocationPicker, useSearchCountryCodes } from '@/hooks/useLocationPicker';
import type { TripLocation } from '@/types/trips.types';
import { LocationConfirmCard } from './LocationConfirmCard';
import { LocationSearchField } from './LocationSearchField';

export interface LocationAutocompleteFieldProps {
  /** @deprecated Plus utilisé — la ville se choisit sur place. */
  basePath?: '/(customer)' | '/(driver)';
  /** @deprecated Plus utilisé — plus de store partagé entre instances. */
  fieldKey?: string;
  label: string;
  value: TripLocation | null;
  onChange: (location: TripLocation | null) => void;
  placeholder?: string;
  countryCode?: string;
}

export function LocationAutocompleteField({
  label,
  value,
  onChange,
  placeholder,
  countryCode,
}: LocationAutocompleteFieldProps) {
  const picker = useLocationPicker(onChange);
  const searchCountryCodes = useSearchCountryCodes(countryCode);
  const isSearchStep = picker.step === 'search';

  const labelNode = label ? (
    <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
      {label}
    </AppText>
  ) : null;

  if (value && isSearchStep) {
    return (
      <View style={styles.container}>
        {labelNode}
        <View style={styles.valueCard}>
          <View style={styles.valueIcon}>
            <IconMapPin size={16} color={colors.primary} />
          </View>
          <AppText variant="sm" weight="semibold" numberOfLines={1} style={styles.valueText}>
            {value.label}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Modifier cette adresse"
            onPress={() => onChange(null)}
            hitSlop={8}
            style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
          >
            <IconX size={16} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {labelNode}

      {/* Masqué (pas démonté) pendant la confirmation : « Changer de lieu » retrouve la recherche. */}
      <View style={isSearchStep ? undefined : styles.hidden}>
        <LocationSearchField
          clearOnSelect={false}
          countryCode={searchCountryCodes}
          placeholder={placeholder}
          onSelect={picker.pickSuggestion}
          onSelectSaved={picker.pickSaved}
          onManualEntry={picker.startManual}
        />
      </View>

      {isSearchStep ? null : <LocationConfirmCard picker={picker} />}
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
  pressed: {
    opacity: 0.7,
  },
  hidden: {
    display: 'none',
  },
  valueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  valueIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: {
    flex: 1,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});