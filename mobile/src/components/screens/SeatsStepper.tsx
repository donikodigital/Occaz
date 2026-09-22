// mobile/src/components/screens/SeatsStepper.tsx
// [21/09/2026] v+ — bleu Ocean au lieu de l'indigo.
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconMinus, IconPlus, IconUsers } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

export interface SeatsStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

function StepButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.stepButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {icon}
    </Pressable>
  );
}

/**
 * Ligne "Nombre de places" avec stepper en pastille. Partagée par
 * vehicle-new.tsx et VehicleDetailModal.tsx. Les boutons se désactivent
 * aux bornes (1 à 12 par défaut, comme avant).
 */
export function SeatsStepper({ value, onChange, min = 1, max = 12 }: SeatsStepperProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconTile}>
        <IconUsers size={18} color={OCEAN.base} />
      </View>
      <AppText variant="sm" weight="semibold" style={styles.label}>
        Nombre de places
      </AppText>

      <View style={styles.stepper}>
        <StepButton
          icon={<IconMinus size={16} color={colors.textPrimary} />}
          label="Retirer une place"
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        />
        <AppText variant="md" weight="bold" style={styles.value} accessibilityLiveRegion="polite">
          {value}
        </AppText>
        <StepButton
          icon={<IconPlus size={16} color={colors.textPrimary} />}
          label="Ajouter une place"
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  value: {
    minWidth: 36,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.35,
  },
});