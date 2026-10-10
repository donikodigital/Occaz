// mobile/src/components/screens/CityPickerScreen.tsx
//
// v2 — Look Ocean : bandeau héro (icône, titre, aide, fermeture) qui porte le
// champ de recherche ; en dessous, les résultats en carte ou une invitation à
// taper les premières lettres. Le comportement ne change pas (2 lettres
// minimum, sélection dans citySelectionStore puis retour).
import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { IconBuildingCommunity } from '@tabler/icons-react-native';
import { ScreenContainer } from '@/components/ui';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import type { City } from '@/types/geography.types';
import { CitySearchPanel } from './CitySearchPanel';
import { SearchHeroHeader, SearchHeroInput } from './SearchHeroHeader';

export function CityPickerScreen() {
  const selectCity = useCitySelectionStore((state) => state.select);
  const [search, setSearch] = useState('');
  const [isLoading, setLoading] = useState(false);

  function handleSelect(city: City) {
    selectCity(city);
    router.back();
  }

  return (
    <ScreenContainer edges={['top', 'bottom']} maxWidth="form" padded={false}>
      <SearchHeroHeader
        icon={<IconBuildingCommunity size={24} color={OCEAN.onDark} strokeWidth={1.7} />}
        caption="Recherche de ville"
        title="Choisir une ville"
        subtitle="Tapez les premières lettres de son nom."
        onClose={() => router.back()}
      >
        <SearchHeroInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une ville…"
          autoFocus
          loading={isLoading}
        />
      </SearchHeroHeader>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <CitySearchPanel
          hideField
          value={search}
          onChangeValue={setSearch}
          onLoadingChange={setLoading}
          onSelect={handleSelect}
        />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.xl,
  },
});
