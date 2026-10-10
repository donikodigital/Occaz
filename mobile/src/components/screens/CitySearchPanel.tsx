// mobile/src/components/screens/CitySearchPanel.tsx
//
// Recherche de ville réutilisable : plein écran dans CityPickerScreen,
// en ligne dans LocationConfirmCard (aucune navigation, aucun store global).
// Les résultats sont rendus avec un simple .map (20 lignes au plus) pour
// pouvoir s'imbriquer dans un ScrollView sans liste virtualisée.
//
// v2 — Mode « page » : le champ de saisie vit alors dans le bandeau de
// l'écran (SearchHeroHeader). Le texte est piloté de l'extérieur
// (`value` / `onChangeValue`) et `hideField` retire le champ du panneau.
// L'état vide devient une vraie invitation à écrire plutôt qu'une zone blanche.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { IconCheck, IconMapPin, IconMapSearch, IconSearch, IconSearchOff } from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { OceanEmpty } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCitySearch } from '@/hooks/useCities';
import type { City } from '@/types/geography.types';

const DEBOUNCE_MS = 250;
const MIN_SEARCH_LENGTH = 2;

export interface CitySearchPanelProps {
  onSelect: (city: City) => void;
  autoFocus?: boolean;
  /** Ville actuellement choisie : affichée avec une coche dans les résultats. */
  selectedCityId?: string | null;
  /** Texte saisi, piloté par l'écran (le champ est alors dans le bandeau). Sans cela, le panneau gère sa propre saisie. */
  value?: string;
  onChangeValue?: (text: string) => void;
  /** Ne pas afficher le champ de saisie (il est fourni ailleurs) et soigner l'état vide pour une page entière. */
  hideField?: boolean;
  /** Signale à l'écran que la recherche est en cours (pour l'indicateur du champ du bandeau). */
  onLoadingChange?: (isLoading: boolean) => void;
}

export function CitySearchPanel({
  onSelect,
  autoFocus,
  selectedCityId,
  value,
  onChangeValue,
  hideField,
  onLoadingChange,
}: CitySearchPanelProps) {
  const [ownSearch, setOwnSearch] = useState('');
  const search = value ?? ownSearch;
  const setSearch = onChangeValue ?? setOwnSearch;
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data, isFetching } = useCitySearch(debouncedSearch);
  const cities = data?.data ?? [];
  const trimmed = search.trim();
  const isTyping = trimmed !== debouncedSearch;
  const isLoading = trimmed.length >= MIN_SEARCH_LENGTH && (isFetching || isTyping) && cities.length === 0;

  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  return (
    <View>
      {hideField ? null : (
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
      )}

      {trimmed.length < MIN_SEARCH_LENGTH ? (
        hideField ? (
          <OceanEmpty
            icon={<IconMapSearch size={30} color={OCEAN.base} strokeWidth={1.7} />}
            title="Quelle ville ?"
            text={`Tapez au moins ${MIN_SEARCH_LENGTH} lettres du nom de la ville, les résultats s'affichent aussitôt.`}
          />
        ) : (
          <AppText variant="sm" color="textMuted" style={styles.message}>
            Tapez au moins {MIN_SEARCH_LENGTH} lettres du nom de la ville.
          </AppText>
        )
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
                  <IconMapPin size={18} color={OCEAN.base} />
                </View>
                <AppText variant="base" weight={isSelected ? 'bold' : 'semibold'} color={OCEAN.deep} style={styles.rowText}>
                  {city.name}
                </AppText>
                {isSelected ? <IconCheck size={18} color={OCEAN.base} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : isFetching || isTyping ? (
        <View style={styles.status}>
          <ActivityIndicator size="small" color={OCEAN.base} />
          <AppText variant="sm" color="textSecondary">
            Recherche…
          </AppText>
        </View>
      ) : hideField ? (
        <OceanEmpty
          icon={<IconSearchOff size={30} color={OCEAN.base} strokeWidth={1.7} />}
          title="Aucune ville trouvée"
          text={`Aucun résultat pour « ${trimmed} ». Vérifiez l'orthographe ou essayez le début du nom.`}
        />
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
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  results: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: OCEAN.line,
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    borderBottomColor: OCEAN.line,
  },
  rowSelected: {
    backgroundColor: OCEAN.mist,
  },
  rowPressed: {
    backgroundColor: OCEAN.mist,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
});
