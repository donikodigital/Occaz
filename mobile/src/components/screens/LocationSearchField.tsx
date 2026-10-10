// mobile/src/components/screens/LocationSearchField.tsx
//
// v2 — Un seul champ, trois sources classées par ordre de confiance :
//   1. les adresses déjà utilisées par l'utilisateur (« Récentes » quand le
//      champ est vide, « Mes adresses » quand il tape) ;
//   2. les suggestions Mapbox ;
//   3. « Ajouter … » : saisie manuelle en dernier recours.
//
// v3 — Look Ocean + mode « page » : l'écran peut héberger le champ dans son
// bandeau (SearchHeroHeader). Il appelle alors lui-même useAddressSearch,
// passe le résultat dans `search` et met `hideField` : ce composant ne rend
// plus que les résultats. Sans ces deux props, il se comporte comme avant
// (champ intégré, utilisé par LocationAutocompleteField sur desktop).
//
// Rétrocompatible : sans `onSelectSaved` ni `onManualEntry`, le composant
// se comporte comme avant (suggestions Mapbox seules, champ vidé après
// sélection). Les suggestions restent affichées en ligne sous le champ,
// sans overlay ni z-index.

import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import * as Location from 'expo-location';
import {
  IconChevronRight,
  IconCurrentLocation,
  IconHistory,
  IconMapPin,
  IconPencil,
  IconSearch,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import { geocodingApi } from '@/services/api/geocoding.api';
import type { GeocodingSuggestion } from '@/types/geocoding.types';
import type { SavedLocation } from '@/types/location-picker.types';

/** Ce que renvoie useAddressSearch — pour héberger le champ de saisie hors de ce composant. */
export type AddressSearchState = ReturnType<typeof useAddressSearch>;

export interface LocationSearchFieldProps {
  countryCode?: string;
  onSelect: (suggestion: GeocodingSuggestion) => void;
  /** Si fourni, les adresses déjà utilisées par l'utilisateur sont proposées en premier. */
  onSelectSaved?: (location: SavedLocation) => void;
  /** Si fourni, propose « Ajouter … » pour garder ce qui a été tapé quand l'adresse est introuvable. */
  onManualEntry?: (label: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  /** Vide le champ après une sélection (comportement historique). Mettre false pour retrouver la saisie au retour arrière. */
  clearOnSelect?: boolean;
  /** État de recherche piloté par l'écran (le champ est alors dans son bandeau). */
  search?: AddressSearchState;
  /** Ne pas afficher le champ de saisie : seuls les résultats sont rendus. */
  hideField?: boolean;
}

function ResultRow({
  icon,
  tone,
  title,
  subtitle,
  onPress,
  isLast,
}: {
  icon: React.ReactNode;
  tone: 'primary' | 'neutral';
  title: string;
  subtitle?: string;
  onPress: () => void;
  isLast: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      style={({ pressed }) => [styles.row, !isLast && styles.rowDivider, pressed && styles.rowPressed]}
    >
      <View style={[styles.rowIcon, tone === 'primary' ? styles.rowIconPrimary : styles.rowIconNeutral]}>{icon}</View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" color={OCEAN.deep} numberOfLines={1}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="xs" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      <IconChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  );
}

function ResultGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      {title ? (
        <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.groupTitle}>
          {title.toUpperCase()}
        </AppText>
      ) : null}
      <View style={styles.groupCard}>{children}</View>
    </View>
  );
}

export function LocationSearchField({
  countryCode,
  onSelect,
  onSelectSaved,
  onManualEntry,
  placeholder,
  autoFocus,
  clearOnSelect = true,
  search,
  hideField = false,
}: LocationSearchFieldProps) {
  // Toujours appelé (règle des hooks) ; sans requête saisie il ne déclenche rien.
  const ownSearch = useAddressSearch(countryCode);
  const { query, setQuery, suggestions, isSearching } = search ?? ownSearch;
  const showSaved = Boolean(onSelectSaved);
  const { data: saved } = useSavedLocations(showSaved ? query : '', showSaved);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | undefined>();

  const trimmed = query.trim();
  const hasQuery = trimmed.length > 0;
  const savedItems = showSaved ? (saved ?? []) : [];
  const canAddManually = Boolean(onManualEntry) && trimmed.length >= 3;

  function handleSelect(suggestion: GeocodingSuggestion) {
    if (clearOnSelect) setQuery('');
    onSelect(suggestion);
  }

  function handleSelectSaved(item: SavedLocation) {
    if (clearOnSelect) setQuery('');
    onSelectSaved?.(item);
  }

  async function handleUseCurrentLocation() {
    setLocationError(undefined);
    setIsLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Autorisez la localisation pour utiliser votre position actuelle.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const suggestion = await geocodingApi.reverse(position.coords.latitude, position.coords.longitude);
      if (!suggestion) {
        setLocationError('Aucune adresse trouvée à votre position actuelle.');
        return;
      }
      handleSelect(suggestion);
    } catch {
      setLocationError("Impossible d'obtenir votre position pour le moment.");
    } finally {
      setIsLocating(false);
    }
  }

  return (
    <View>
      {hideField ? null : (
        <View style={styles.inputWrapper}>
          <IconSearch size={16} color={OCEAN.base} style={styles.searchIcon} />
          <TextField
            value={query}
            onChangeText={setQuery}
            placeholder={placeholder ?? 'Rechercher une adresse…'}
            autoFocus={autoFocus}
            style={styles.input}
          />
          {isSearching ? (
            <ActivityIndicator size="small" color={OCEAN.base} style={styles.trailing} />
          ) : hasQuery ? (
            <Pressable
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel="Effacer la recherche"
              hitSlop={10}
              style={styles.trailing}
            >
              <IconX size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      )}

      {!hasQuery ? (
        <View style={styles.group}>
          <Pressable
            onPress={handleUseCurrentLocation}
            disabled={isLocating}
            accessibilityRole="button"
            accessibilityLabel="Utiliser ma position actuelle"
            style={({ pressed }) => [styles.locateCard, pressed && styles.rowPressed]}
          >
            <View style={styles.locateIcon}>
              {isLocating ? (
                <ActivityIndicator size="small" color={OCEAN.onDark} />
              ) : (
                <IconCurrentLocation size={20} color={OCEAN.onDark} />
              )}
            </View>
            <View style={styles.rowText}>
              <AppText variant="sm" weight="bold" color={OCEAN.deep}>
                Utiliser ma position actuelle
              </AppText>
              {locationError ? (
                <AppText variant="xs" color="danger" numberOfLines={2}>
                  {locationError}
                </AppText>
              ) : (
                <AppText variant="xs" color="textSecondary" numberOfLines={1}>
                  Remplir l'adresse avec le GPS
                </AppText>
              )}
            </View>
            {!isLocating ? <IconChevronRight size={16} color={OCEAN.base} /> : null}
          </Pressable>
        </View>
      ) : null}

      {savedItems.length > 0 ? (
        <ResultGroup title={hasQuery ? 'Mes adresses' : 'Récentes'}>
          {savedItems.map((item, index) => (
            <ResultRow
              key={item.id}
              tone="primary"
              icon={
                hasQuery ? (
                  <IconMapPin size={18} color={OCEAN.base} />
                ) : (
                  <IconHistory size={18} color={OCEAN.base} />
                )
              }
              title={item.label}
              subtitle={[item.cityName, item.formattedAddress].filter(Boolean).join(' · ') || undefined}
              onPress={() => handleSelectSaved(item)}
              isLast={index === savedItems.length - 1}
            />
          ))}
        </ResultGroup>
      ) : null}

      {suggestions.length > 0 ? (
        <ResultGroup title="Suggestions">
          {suggestions.map((suggestion, index) => (
            <ResultRow
              key={`${suggestion.latitude}-${suggestion.longitude}-${index}`}
              tone="neutral"
              icon={<IconMapPin size={18} color={colors.textSecondary} />}
              title={suggestion.label}
              subtitle={suggestion.formattedAddress}
              onPress={() => handleSelect(suggestion)}
              isLast={index === suggestions.length - 1}
            />
          ))}
        </ResultGroup>
      ) : null}

      {canAddManually ? (
        <ResultGroup>
          <ResultRow
            tone="neutral"
            icon={<IconPencil size={18} color={colors.textSecondary} />}
            title={`Ajouter « ${trimmed} »`}
            subtitle="Introuvable ? Gardez votre saisie et choisissez la ville."
            onPress={() => onManualEntry?.(trimmed)}
            isLast
          />
        </ResultGroup>
      ) : null}

      {!hasQuery && savedItems.length === 0 ? (
        <View style={styles.hint}>
          <View style={styles.hintIcon}>
            <IconMapPin size={26} color={OCEAN.base} strokeWidth={1.7} />
          </View>
          <AppText variant="md" weight="semibold" align="center">
            Où se trouve ce lieu ?
          </AppText>
          <AppText variant="sm" color="textSecondary" align="center">
            Tapez un quartier, un repère ou un lieu connu (marché, gare routière, station…). Vos adresses déjà utilisées
            apparaîtront ici.
          </AppText>
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
    paddingRight: spacing.xl + spacing.xxs,
  },
  trailing: {
    position: 'absolute',
    right: spacing.sm + 2,
  },
  group: {
    marginTop: spacing.md,
  },
  groupTitle: {
    marginBottom: spacing.xs,
    marginLeft: spacing.xxs,
    letterSpacing: 0.9,
  },
  groupCard: {
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
  locateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OCEAN.line,
    backgroundColor: OCEAN.mist,
  },
  locateIcon: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: OCEAN.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: OCEAN.line,
  },
  rowPressed: {
    opacity: 0.75,
  },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconPrimary: {
    backgroundColor: OCEAN.mist,
  },
  rowIconNeutral: {
    backgroundColor: colors.surfaceMuted,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  hint: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  hintIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
