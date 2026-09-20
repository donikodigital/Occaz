// mobile/src/components/screens/CitySearchPanel.tsx
//
// Recherche de ville réutilisable : plein écran dans CityPickerScreen,
// en ligne dans LocationConfirmCard (aucune navigation, aucun store global).
// Les résultats sont rendus avec un simple .map (20 lignes au plus) pour
// pouvoir s'imbriquer dans un ScrollView sans liste virtualisée.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { IconCheck, IconMapPin, IconSearch } from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useCitySearch } from '@/hooks/useCities';
import type { City } from '@/types/geography.types';

const DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

export interface CitySearchPanelProps {
  onSelect: (city: City) => void;
  autoFocus?: boolean;
  /** Ville actuellement choisie : affichée avec une coche dans les résultats. */
  selectedCityId?: string | null;
}

export function CitySearchPanel({ onSelect, autoFocus, selectedCityId }: CitySearchPanelProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isFetching } = useCitySearch(debouncedSearch);
  const cities = data?.data ?? [];
  const trimmed = search.trim();
  const isTyping = trimmed !== debouncedSearch;

  return (
    <View>
      <View style={styles.inputWrapper}>
        <IconSearch size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une ville…"
          autoFocus={autoFocus}
          style={styles.input}
        />
      </View>

      {trimmed.length < MIN_SEARCH_LENGTH ? (
        <AppText variant="sm" color="textMuted" style={styles.message}>
          Tapez au moins {MIN_SEARCH_LENGTH} lettres du nom de la ville.
        </AppText>
      ) : cities.length > 0 ? (
        <View style={styles.results}>
          {cities.map((city, index) => {
            const isSelected = city.id === selectedCityId;
            return (
              <Pressable
                key={city.id}
                onPress={() => onSelect(city)}
                accessibilityRole="button"
                accessibilityLabel={`Choisir ${city.name}`}
                style={({ pressed }) => [
                  styles.row,
                  index < cities.length - 1 && styles.rowDivider,
                  isSelected && styles.rowSelected,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.rowIcon}>
                  <IconMapPin size={16} color={colors.primary} />
                </View>
                <AppText variant="base" weight={isSelected ? 'semibold' : 'medium'} style={styles.rowText}>
                  {city.name}
                </AppText>
                {isSelected ? <IconCheck size={16} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : isFetching || isTyping ? (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={colors.primary} />
          <AppText variant="sm" color="textSecondary">
            Recherche…
          </AppText>
        </View>
      ) : (
        <AppText variant="sm" color="textMuted" style={styles.message}>
          Aucune ville trouvée pour « {trimmed} ».
        </AppText>
      )}
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
  message: {
    marginTop: spacing.sm,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  results: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm + 2,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.primaryLight,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
});