// mobile/src/components/screens/VehicleTypePicker.tsx
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  IconBus,
  IconCar,
  IconCarSuv,
  IconCaravan,
  IconCheck,
  IconDots,
  IconMotorbike,
  IconTruck,
  IconTruckDelivery,
} from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { VEHICLE_TYPE_OPTIONS } from '@/utils/vehicleLabels';
import type { VehicleType } from '@/types/vehicles.types';

export type VehicleIcon = React.ComponentType<{ size?: number; color?: string; stroke?: number }>;

/**
 * Une icône par type — seul endroit à modifier si tu veux en changer une.
 * Exportée pour que l'en-tête de VehicleDetailModal réutilise la même icône.
 */
export const VEHICLE_TYPE_ICONS: Record<VehicleType, VehicleIcon> = {
  SEDAN: IconCar,
  SUV: IconCarSuv,
  MINIVAN: IconCaravan,
  MINIBUS: IconBus,
  PICKUP: IconTruckDelivery,
  MOTORCYCLE: IconMotorbike,
  TRUCK: IconTruck,
  OTHER: IconDots,
};

/**
 * Écart entre tuiles : appliqué en padding sur chaque cellule (25 % de
 * large) et compensé par une marge négative sur la grille, pour que les
 * 4 colonnes restent parfaitement alignées quelle que soit la largeur.
 */
const GAP = spacing.xs;

export interface VehicleTypePickerProps {
  value: VehicleType;
  onChange: (type: VehicleType) => void;
}

/**
 * Sélecteur de type de véhicule en grille 4 × 2 de tuiles (icône + libellé).
 * Partagé par vehicle-new.tsx et VehicleDetailModal.tsx pour que les deux
 * écrans restent identiques. Bordures de 1 px volontairement : une bordure
 * de 1,5 px donne des pixels fractionnaires (traits parasites) sur les
 * écrans à DPR 3 en rendu web.
 */
export function VehicleTypePicker({ value, onChange }: VehicleTypePickerProps) {
  return (
    <View accessibilityRole="radiogroup" style={styles.grid}>
      {VEHICLE_TYPE_OPTIONS.map((item) => {
        const isActive = item.value === value;
        const Icon = VEHICLE_TYPE_ICONS[item.value];

        return (
          <View key={item.value} style={styles.cell}>
            <Pressable
              onPress={() => onChange(item.value)}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ selected: isActive }}
              style={({ pressed }) => [
                styles.tile,
                isActive && styles.tileActive,
                pressed && styles.tilePressed,
              ]}
            >
              <Icon size={26} color={isActive ? colors.primary : colors.textSecondary} stroke={1.7} />
              <AppText
                variant="xs"
                weight={isActive ? 'semibold' : 'medium'}
                color={isActive ? 'primaryDark' : 'textPrimary'}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.8}
                style={styles.label}
              >
                {item.label}
              </AppText>

              {isActive ? (
                <View style={styles.check}>
                  <IconCheck size={10} color={colors.onPrimary} stroke={3} />
                </View>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -GAP / 2,
  },
  cell: {
    width: '25%',
    padding: GAP / 2,
  },
  tile: {
    minHeight: 84,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: spacing.xxs,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tileActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tilePressed: {
    transform: [{ scale: 0.96 }],
  },
  label: {
    maxWidth: '100%',
    textAlign: 'center',
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});