// mobile/src/components/screens/SpaceSwitchSection.tsx
// [19/10/2026] v1 — Section « Mes espaces » des menus de profil : un même compte (même numéro, même code PIN) peut être passager ET conducteur.
// - Depuis l'espace conducteur : « Utiliser Occa'Z comme passager » (code PIN demandé la première fois).
// - Depuis l'espace passager : « Passer en mode conducteur » / « Devenir conducteur » (création du profil conducteur la première fois).
// Un conducteur dont le dossier est en attente peut toujours passer en mode passager.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowsExchange, IconChevronRight, IconSteeringWheel, IconUser } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAccountRoles, useSwitchSpace } from '@/hooks/useAccountRoles';
import { useActiveSpaceStore } from '@/stores/activeSpaceStore';
import type { Space } from '@/types/roles.types';

export function SpaceSwitchSection({ current }: { current: Space }) {
  const { data: roles } = useAccountRoles();
  const switchTo = useSwitchSpace();
  const setSpace = useActiveSpaceStore((state) => state.setSpace);

  // Le compte des équipes (support, administration) n'a pas d'espace à ouvrir.
  if (roles && roles.primary !== 'CUSTOMER' && roles.primary !== 'DRIVER') return null;

  const isDriverSpace = current === 'DRIVER';
  const label = isDriverSpace
    ? "Utiliser Occa'Z comme passager"
    : roles?.driver
      ? 'Passer en mode conducteur'
      : 'Devenir conducteur';
  const hint = isDriverSpace
    ? roles?.customer
      ? 'Réservez un trajet ou envoyez un colis avec le même compte.'
      : 'Même numéro, même code PIN. Votre portefeuille conducteur reste séparé.'
    : roles?.driver
      ? 'Retrouvez vos trajets, vos colis et votre portefeuille conducteur.'
      : 'Proposez vos trajets avec le même compte : un dossier à compléter, une semaine pour le régulariser.';

  function handlePress() {
    if (isDriverSpace) {
      if (roles?.customer) switchTo('CUSTOMER');
      else router.push('/(driver)/become-passenger');
      return;
    }
    if (roles?.driver) {
      switchTo('DRIVER');
      return;
    }
    // Pas encore de profil conducteur : l'écran « Complétez votre profil » le crée (nom, ville, puis pièces).
    setSpace('DRIVER');
    router.replace('/(driver)/complete-profile');
  }

  return (
    <OceanSection icon={<IconArrowsExchange size={17} color={OCEAN.base} />} title="Mes espaces">
      <Pressable
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <View style={styles.icon}>
          {isDriverSpace ? <IconUser size={18} color={OCEAN.base} /> : <IconSteeringWheel size={18} color={OCEAN.base} />}
        </View>
        <View style={styles.text}>
          <AppText variant="sm" weight="semibold">
            {label}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {hint}
          </AppText>
        </View>
        <IconChevronRight size={16} color={colors.textMuted} />
      </Pressable>
    </OceanSection>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  pressed: { opacity: 0.7 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, gap: 2 },
});
