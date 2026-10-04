// mobile/src/components/screens/LockedField.tsx
//
// Champ en lecture seule pour une information qui vient du profil (nom, téléphone, adresse) : même gabarit qu'un champ de
// saisie, mais grisé, avec un cadenas, et jamais éditable ici. La note sous le champ dit où la modifier.
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { IconLock } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

export function LockedField({
  label,
  value,
  secondary,
  placeholder = '—',
}: {
  label: string;
  /** Valeur du profil ; vide = « placeholder » est affiché. */
  value?: string | null;
  /** Ligne secondaire sous la valeur (ex. « Kindia, Guinée »). */
  secondary?: string | null;
  placeholder?: string;
}) {
  const hasValue = Boolean(value && value.trim().length > 0);
  return (
    <View style={styles.container}>
      <AppText variant="sm" weight="medium" color="textSecondary" style={styles.label}>
        {label}
      </AppText>
      <View style={styles.field} accessibilityRole="text" accessibilityLabel={`${label} : ${hasValue ? value : 'non renseigné'}, verrouillé`}>
        <View style={styles.text}>
          <AppText variant="base" color={hasValue ? 'textPrimary' : 'textMuted'} numberOfLines={2}>
            {hasValue ? value : placeholder}
          </AppText>
          {secondary ? (
            <AppText variant="xs" color="textSecondary" numberOfLines={1}>
              {secondary}
            </AppText>
          ) : null}
        </View>
        <IconLock size={16} color={OCEAN.base} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xxs,
  },
  label: {
    marginBottom: spacing.xxs,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: OCEAN.mist,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
