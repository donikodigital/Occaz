// mobile/src/components/screens/LocationSearchField.tsx
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { IconMapPin, IconSearch } from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import type { GeocodingSuggestion } from '@/types/geocoding.types';

export interface LocationSearchFieldProps {
  countryCode?: string;
  onSelect: (suggestion: GeocodingSuggestion) => void;
  placeholder?: string;
}

/**
 * Suggestions affichées en ligne, sous le champ (poussent le contenu
 * suivant vers le bas) plutôt qu'en survol flottant — évite toute
 * gestion de z-index/overlay pour un gain d'expérience marginal ici.
 */
export function LocationSearchField({ countryCode, onSelect, placeholder }: LocationSearchFieldProps) {
  const { query, setQuery, suggestions, isSearching } = useAddressSearch(countryCode);

  function handleSelect(suggestion: GeocodingSuggestion) {
    setQuery('');
    onSelect(suggestion);
  }

  return (
    <View>
      <View style={styles.inputWrapper}>
        <IconSearch size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder ?? 'Rechercher une adresse…'}
          style={styles.input}
        />
        {isSearching ? <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} /> : null}
      </View>

      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((suggestion, index) => (
            <Pressable
              key={`${suggestion.latitude}-${suggestion.longitude}-${index}`}
              onPress={() => handleSelect(suggestion)}
              style={({ pressed }) => [styles.suggestionRow, pressed && styles.suggestionRowPressed]}
            >
              <IconMapPin size={15} color={colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <AppText variant="sm" weight="medium" numberOfLines={1}>
                  {suggestion.label}
                </AppText>
                <AppText variant="xs" color="textSecondary" numberOfLines={1}>
                  {suggestion.formattedAddress}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  searchIcon: {
    position: 'absolute',
    left: spacing.sm + 2,
    zIndex: 1,
  },
  input: {
    paddingLeft: spacing.xl + spacing.xxs,
  },
  spinner: {
    position: 'absolute',
    right: spacing.sm + 2,
  },
  suggestions: {
    marginTop: spacing.xs,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  suggestionRowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
});
