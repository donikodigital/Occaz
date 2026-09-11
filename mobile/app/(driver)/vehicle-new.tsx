// mobile/app/(driver)/vehicle-new.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconMinus, IconPlus } from '@tabler/icons-react-native';
import { AppText, Button, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { ApiError } from '@/services/api/ApiError';
import type { VehicleType } from '@/types/vehicles.types';

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'SEDAN', label: 'Berline' },
  { value: 'SUV', label: 'SUV' },
  { value: 'VAN', label: 'Van' },
  { value: 'MINIBUS', label: 'Minibus' },
  { value: 'PICKUP', label: 'Pick-up' },
  { value: 'MOTORCYCLE', label: 'Moto' },
];

export default function NewVehicleScreen() {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('SEDAN');
  const [totalSeats, setTotalSeats] = useState(4);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createVehicle = useCreateVehicle();

  function handleSubmit() {
    setErrorMessage(undefined);
    if (brand.trim().length < 1 || model.trim().length < 1) {
      setErrorMessage('Renseignez la marque et le modèle.');
      return;
    }
    if (plateNumber.trim().length < 3) {
      setErrorMessage("Renseignez la plaque d'immatriculation.");
      return;
    }

    createVehicle.mutate(
      {
        brand: brand.trim(),
        model: model.trim(),
        color: color.trim() || undefined,
        plateNumber: plateNumber.trim().toUpperCase(),
        type,
        totalSeats,
      },
      {
        onSuccess: () => router.back(),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Ajouter un véhicule
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.typeRow}>
        {VEHICLE_TYPES.map((item) => {
          const isActive = item.value === type;
          return (
            <Pressable
              key={item.value}
              onPress={() => setType(item.value)}
              style={[styles.typeChip, isActive && styles.typeChipActive]}
            >
              <AppText variant="sm" weight="medium" color={isActive ? colors.onPrimary : 'textPrimary'}>
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.fields}>
        <TextField label="Marque" value={brand} onChangeText={setBrand} placeholder="Toyota" />
        <TextField label="Modèle" value={model} onChangeText={setModel} placeholder="Corolla" />
        <TextField label="Couleur (optionnel)" value={color} onChangeText={setColor} placeholder="Gris" />
        <TextField
          label="Plaque d'immatriculation"
          value={plateNumber}
          onChangeText={setPlateNumber}
          placeholder="RC-1234-GN"
          autoCapitalize="characters"
        />

        <View>
          <AppText variant="sm" weight="medium" color="textSecondary" style={styles.stepperLabel}>
            Nombre de places
          </AppText>
          <View style={styles.stepper}>
            <IconButton
              icon={<IconMinus size={16} color={colors.textPrimary} />}
              accessibilityLabel="Retirer une place"
              onPress={() => setTotalSeats((s) => Math.max(1, s - 1))}
            />
            <AppText variant="lg" weight="semibold" style={styles.stepperValue}>
              {totalSeats}
            </AppText>
            <IconButton
              icon={<IconPlus size={16} color={colors.textPrimary} />}
              accessibilityLabel="Ajouter une place"
              onPress={() => setTotalSeats((s) => Math.min(12, s + 1))}
            />
          </View>
        </View>
      </View>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button
        label="Ajouter le véhicule"
        onPress={handleSubmit}
        loading={createVehicle.isPending}
        style={styles.submit}
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
    marginBottom: spacing.lg,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  typeChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepperLabel: {
    marginBottom: spacing.xxs,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  stepperValue: {
    minWidth: 24,
    textAlign: 'center',
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
