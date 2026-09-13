// mobile/app/(driver)/vehicle-new.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconMinus, IconPlus } from '@tabler/icons-react-native';
import { AppText, Button, DocumentUploadField, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { useVehicleDocumentUpload, useVehicleDocuments } from '@/hooks/useVehicleDocuments';
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

/** Deuxième étape affichée juste après la création — le véhicule existe déjà en base, seuls ses documents manquent avant validation. */
function VehicleDocumentsStep({ vehicleId }: { vehicleId: string }) {
  const { data: documents } = useVehicleDocuments(vehicleId);
  const upload = useVehicleDocumentUpload(vehicleId);

  const registrationDoc = documents?.find((d) => d.type === 'vehicle_registration');
  const insuranceDoc = documents?.find((d) => d.type === 'vehicle_insurance');

  return (
    <ScreenContainer scroll maxWidth="form">
      <View style={styles.header}>
        <View style={{ width: 38 }} />
        <AppText variant="lg" weight="semibold">
          Documents du véhicule
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <AppText variant="sm" color="textSecondary" style={styles.intro}>
        Véhicule ajouté. Envoyez sa carte grise et son assurance pour qu&apos;il soit validé par notre équipe.
      </AppText>

      <View style={styles.fields}>
        <DocumentUploadField
          label="Carte grise"
          document={registrationDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('vehicle_registration')}
          onPickCamera={() => upload.pickFromCamera('vehicle_registration')}
        />
        <DocumentUploadField
          label="Assurance"
          document={insuranceDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('vehicle_insurance')}
          onPickCamera={() => upload.pickFromCamera('vehicle_insurance')}
        />
      </View>

      <Button label="Terminer" onPress={() => router.back()} style={styles.submit} />
    </ScreenContainer>
  );
}

export default function NewVehicleScreen() {
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [color, setColor] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [type, setType] = useState<VehicleType>('SEDAN');
  const [totalSeats, setTotalSeats] = useState(4);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [createdVehicleId, setCreatedVehicleId] = useState<string | null>(null);
  const createVehicle = useCreateVehicle();

  if (createdVehicleId) {
    return <VehicleDocumentsStep vehicleId={createdVehicleId} />;
  }

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
        onSuccess: (vehicle) => setCreatedVehicleId(vehicle.id),
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
  intro: {
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
