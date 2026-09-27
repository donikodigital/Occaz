// mobile/src/components/screens/LocationPickerScreen.tsx
//
// v3 — Saisie d'adresse simplifiée. Avant : recherche -> choix de la ville
// sur un autre écran -> re-saisie de l'adresse. Maintenant :
//   - on tape, on touche un résultat : la ville est détectée toute seule ;
//   - les adresses déjà utilisées sont proposées en premier (« Récentes ») ;
//   - la ville ne se choisit à la main, sur place, que si la détection échoue ;
//   - la recherche est limitée aux pays actifs de la plateforme.
// Tout le parcours vit dans useLocationPicker (partagé avec le champ desktop
// LocationAutocompleteField).

import React from 'react';
import { Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { IconX } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useLocationPicker, useSearchCountryCodes } from '@/hooks/useLocationPicker';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { LocationConfirmCard } from './LocationConfirmCard';
import { LocationSearchField } from './LocationSearchField';

/**
 * select-location s'ouvre en `presentation: 'modal'` (voir _layout.tsx) —
 * fermer un modal pendant que le clavier est encore en train de se
 * fermer est un cas connu d'écran noir sur Android avec react-native-
 * screens, pire qu'un simple push/pop. Dismiss keyboard seul (voir
 * LocationConfirmCard) a réduit le problème sans l'éliminer : selon la
 * rapidité du réseau, `router.back()` pouvait encore arriver avant la
 * fin réelle de l'animation de fermeture du clavier. Ici on attend la
 * confirmation native `keyboardDidHide` — avec un filet de sécurité, au
 * cas où le clavier était déjà fermé (ex. sélection d'une adresse
 * enregistrée sans avoir tapé), auquel cas cet événement ne se
 * déclenche jamais.
 */
function waitForKeyboardToClose(maxWaitMs = 300): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      subscription.remove();
      resolve();
    };
    const timeout = setTimeout(finish, maxWaitMs);
    const subscription = Keyboard.addListener('keyboardDidHide', finish);
    Keyboard.dismiss();
  });
}

export interface LocationPickerScreenProps {
  /**
   * Conservé pour compatibilité avec les fichiers route existants
   * ((customer) et (driver) passent encore basePath). Plus utilisé : la
   * ville se choisit désormais sur place, sans navigation.
   */
  basePath?: '/(customer)' | '/(driver)';
  /** Code(s) pays ISO pour restreindre la recherche. Par défaut : les pays actifs de la plateforme. */
  countryCode?: string;
}

export function LocationPickerScreen({ countryCode }: LocationPickerScreenProps) {
  const { title } = useLocalSearchParams<{ title?: string }>();
  const selectLocation = useLocationSelectionStore((state) => state.select);
  const searchCountryCodes = useSearchCountryCodes(countryCode);

  const picker = useLocationPicker((location) => {
    selectLocation(location);
    waitForKeyboardToClose().then(() => router.back());
  });

  const isSearchStep = picker.step === 'search';

  return (
    <ScreenContainer edges={['top', 'bottom']} maxWidth="form">
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText variant="lg" weight="semibold">
            {title ?? 'Adresse'}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {isSearchStep ? 'Recherchez un lieu, un quartier ou un repère.' : 'Vérifiez avant de confirmer.'}
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
        {/* Le champ reste monté (simplement masqué) à l'étape 2 : « Changer de lieu » retrouve la recherche et ses résultats. */}
        <View style={isSearchStep ? undefined : styles.hidden}>
          <LocationSearchField
            autoFocus
            clearOnSelect={false}
            countryCode={searchCountryCodes}
            placeholder="Ex : marché, gare routière, quartier…"
            onSelect={picker.pickSuggestion}
            onSelectSaved={picker.pickSaved}
            onManualEntry={picker.startManual}
          />
        </View>

        {isSearchStep ? null : <LocationConfirmCard picker={picker} />}
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
  hidden: {
    display: 'none',
  },
});