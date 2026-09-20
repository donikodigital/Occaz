// mobile/src/components/screens/CityPickerScreen.tsx
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconX } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import type { City } from '@/types/geography.types';
import { CitySearchPanel } from './CitySearchPanel';

export function CityPickerScreen() {
  const selectCity = useCitySelectionStore((state) => state.select);

  function handleSelect(city: City) {
    selectCity(city);
    router.back();
  }

  return (
    <ScreenContainer edges={['top', 'bottom']} maxWidth="form">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="lg" weight="semibold">
            Choisir une ville
          </AppText>
          <AppText variant="sm" color="textSecondary">
            Tapez les premières lettres de son nom.
          </AppText>
        </View>
        <IconButton
          icon={<IconX size={18} color={colors.textPrimary} />}
          accessibilityLabel="Fermer"
          onPress={() => router.back()}
        />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <CitySearchPanel autoFocus onSelect={handleSelect} />
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  content: {
    paddingBottom: spacing.xl,
  },
});