// mobile/src/components/screens/CityPickerScreen.tsx
import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconMapPin, IconX } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useCitySearch } from '@/hooks/useCities';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import type { City } from '@/types/geography.types';

export function CityPickerScreen() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useCitySearch(search);
  const selectCity = useCitySelectionStore((state) => state.select);

  function handleSelect(city: City) {
    selectCity(city);
    router.back();
  }

  return (
    <ScreenContainer edges={['top', 'bottom']} maxWidth="form">
      <View style={styles.header}>
        <AppText variant="lg" weight="semibold">
          Choisir une ville
        </AppText>
        <IconButton
          icon={<IconX size={18} color={colors.textPrimary} />}
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
        />
      </View>

      <TextField
        value={search}
        onChangeText={setSearch}
        placeholder="Rechercher une ville…"
        autoFocus
        style={styles.searchField}
      />

      <FlatList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          search.length < 2
            ? undefined
            : () => (
                <AppText variant="sm" color="textMuted" style={styles.empty}>
                  {isLoading ? 'Recherche…' : 'Aucune ville trouvée.'}
                </AppText>
              )
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => handleSelect(item)} style={styles.row}>
            <IconMapPin size={16} color={colors.textSecondary} />
            <AppText variant="base">{item.name}</AppText>
          </Pressable>
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  searchField: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },
});
