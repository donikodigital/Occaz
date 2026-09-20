// mobile/src/components/screens/LocationSearchField.tsx
//
// v2 — Un seul champ, trois sources classées par ordre de confiance :
//   1. les adresses déjà utilisées par l'utilisateur (« Récentes » quand le
//      champ est vide, « Mes adresses » quand il tape) ;
//   2. les suggestions Mapbox ;
//   3. « Ajouter … » : saisie manuelle en dernier recours.
//
// Rétrocompatible : sans `onSelectSaved` ni `onManualEntry`, le composant
// se comporte comme avant (suggestions Mapbox seules, champ vidé après
// sélection). Les suggestions restent affichées en ligne sous le champ,
// sans overlay ni z-index.

import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import {
  IconChevronRight,
  IconHistory,
  IconMapPin,
  IconPencil,
  IconSearch,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useAddressSearch } from '@/hooks/useAddressSearch';
import { useSavedLocations } from '@/hooks/useSavedLocations';
import type { GeocodingSuggestion } from '@/types/geocoding.types';
import type { SavedLocation } from '@/types/location-picker.types';

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
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
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
        <AppText variant="sm" weight="semibold" color="textSecondary" style={styles.groupTitle}>
          {title}
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
}: LocationSearchFieldProps) {
  const { query, setQuery, suggestions, isSearching } = useAddressSearch(countryCode);
  const showSaved = Boolean(onSelectSaved);
  const { data: saved } = useSavedLocations(showSaved ? query : '', showSaved);

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

  return (
    <View>
      <View style={styles.inputWrapper}>
        <IconSearch size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextField
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder ?? 'Rechercher une adresse…'}
          autoFocus={autoFocus}
          style={styles.input}
        />
        {isSearching ? (
          <ActivityIndicator size="small" color={colors.primary} style={styles.trailing} />
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

      {savedItems.length > 0 ? (
        <ResultGroup title={hasQuery ? 'Mes adresses' : 'Récentes'}>
          {savedItems.map((item, index) => (
            <ResultRow
              key={item.id}
              tone="primary"
              icon={
                hasQuery ? (
                  <IconMapPin size={16} color={colors.primary} />
                ) : (
                  <IconHistory size={16} color={colors.primary} />
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
              icon={<IconMapPin size={16} color={colors.textSecondary} />}
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
            icon={<IconPencil size={16} color={colors.textSecondary} />}
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
            <IconMapPin size={22} color={colors.primary} />
          </View>
          <AppText variant="base" weight="semibold">
            Où se trouve ce lieu ?
          </AppText>
          <AppText variant="sm" color="textSecondary" style={styles.hintText}>
            Tapez un quartier, un repère ou un lieu connu (marché, gare routière, station…).
            Vos adresses déjà utilisées apparaîtront ici.
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
  },
  groupCard: {
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
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.sm + 2,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: {
    backgroundColor: colors.surfaceMuted,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconPrimary: {
    backgroundColor: colors.primaryLight,
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
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  hintText: {
    textAlign: 'center',
  },
});