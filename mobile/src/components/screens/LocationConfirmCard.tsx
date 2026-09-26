// mobile/src/components/screens/LocationConfirmCard.tsx
//
// Étape 2 du parcours de saisie d'adresse (voir useLocationPicker) :
// vérification du nom du lieu et de la ville avant validation. La ville
// arrive déjà détectée dans le cas courant ; elle ne se choisit à la main
// que si la détection échoue ou si l'utilisateur veut la corriger.

import React from 'react';
import { ActivityIndicator, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { IconArrowLeft, IconMapPin, IconPencil } from '@tabler/icons-react-native';
import { AppText, Button, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import type { LocationPickerController } from '@/hooks/useLocationPicker';
import { CitySearchPanel } from './CitySearchPanel';

export interface LocationConfirmCardProps {
  picker: LocationPickerController;
}

export function LocationConfirmCard({ picker }: LocationConfirmCardProps) {
  const { draft, city, cityStatus, isChangingCity } = picker;
  if (!draft) return null;

  const isDetecting = cityStatus === 'detecting';
  const showCityPanel = !isDetecting && (cityStatus === 'unresolved' || isChangingCity);
  const hasPoint = draft.latitude !== undefined && draft.longitude !== undefined;

  return (
    <View>
      <Pressable
        onPress={picker.backToSearch}
        accessibilityRole="button"
        accessibilityLabel="Changer de lieu"
        style={({ pressed }) => [styles.backLink, pressed && styles.pressed]}
      >
        <IconArrowLeft size={16} color={colors.textSecondary} />
        <AppText variant="sm" color="textSecondary">
          Changer de lieu
        </AppText>
      </Pressable>

      <View style={styles.card}>
        <View style={styles.placeRow}>
          <View style={styles.placeIcon}>
            <IconMapPin size={20} color={colors.primary} />
          </View>
          <View style={styles.placeText}>
            <AppText variant="sm" weight="semibold">
              {hasPoint ? 'Adresse trouvée' : 'Adresse saisie à la main'}
            </AppText>
            <AppText variant="xs" color="textSecondary" numberOfLines={2}>
              {draft.formattedAddress ?? 'Sans position GPS'}
            </AppText>
          </View>
        </View>

        <TextField
          label="Nom du lieu ou repère"
          value={draft.label}
          onChangeText={picker.setLabel}
          placeholder="Ex : nom du lieu, près de la station"
        />

        <View style={styles.citySection}>
          <AppText variant="sm" weight="medium" color="textSecondary">
            Ville
          </AppText>

          {isDetecting ? (
            <View style={styles.detecting}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText variant="sm" color="textSecondary" style={styles.detectingText}>
                Détection de la ville…
              </AppText>
              <Pressable onPress={picker.chooseCityManually} accessibilityRole="button" hitSlop={8}>
                <AppText variant="sm" weight="medium" color="primary">
                  Choisir moi-même
                </AppText>
              </Pressable>
            </View>
          ) : null}

          {!isDetecting && city && !isChangingCity ? (
            <View style={styles.cityRow}>
              <View style={styles.cityChip}>
                <IconMapPin size={14} color={colors.primary} />
                <AppText variant="sm" weight="semibold" color="primary">
                  {city.name}
                </AppText>
              </View>
              <Pressable
                onPress={picker.toggleChangeCity}
                accessibilityRole="button"
                accessibilityLabel="Modifier la ville"
                hitSlop={8}
                style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
              >
                <IconPencil size={14} color={colors.primary} />
                <AppText variant="sm" weight="medium" color="primary">
                  Modifier
                </AppText>
              </Pressable>
            </View>
          ) : null}

          {showCityPanel ? (
            <View>
              <AppText variant="sm" color="textSecondary" style={styles.cityPrompt}>
                {city ? 'Choisissez une autre ville.' : 'Dans quelle ville se trouve ce lieu ?'}
              </AppText>
              <CitySearchPanel autoFocus onSelect={picker.selectCity} selectedCityId={city?.id} />
              {city ? (
                <Pressable
                  onPress={picker.toggleChangeCity}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.cancelLink, pressed && styles.pressed]}
                >
                  <AppText variant="sm" color="textSecondary">
                    Garder {city.name}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {!hasPoint ? (
          <AppText variant="xs" color="textMuted">
            Sans position GPS, l'itinéraire ne pourra pas s'afficher sur la carte.
          </AppText>
        ) : null}

        {picker.errorMessage ? (
          <AppText variant="sm" color="danger">
            {picker.errorMessage}
          </AppText>
        ) : null}
      </View>

      <Button
        label="Confirmer l'adresse"
        onPress={() => {
          // Le champ « Nom du lieu » a souvent encore le focus ici (voir
          // capture) : fermer le clavier avant l'appel réseau, plutôt que
          // de le laisser encore ouvert/en fermeture au moment du
          // router.back() qui suit, a déjà produit un écran noir au
          // retour sur Android.
          Keyboard.dismiss();
          picker.confirm();
        }}
        loading={picker.isSubmitting || isDetecting}
        style={styles.submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingVertical: spacing.xs,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  placeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeText: {
    flex: 1,
    gap: 2,
  },
  citySection: {
    gap: spacing.xs,
  },
  detecting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detectingText: {
    flex: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm + 2,
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  cityPrompt: {
    marginBottom: spacing.xs,
  },
  cancelLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
    marginTop: spacing.xxs,
  },
  submit: {
    marginTop: spacing.lg,
  },
});