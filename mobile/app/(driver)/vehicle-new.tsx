// mobile/app/(driver)/vehicle-new.tsx
// [21/09/2026] v2 — habillage bleu Ocean (en-tête, sections), comme la modale de modification du véhicule.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCar, IconFileText, IconSteeringWheel } from '@tabler/icons-react-native';
import { AppText, DocumentUploadField, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { SeatsStepper } from '@/components/screens/SeatsStepper';
import { VehicleTypePicker } from '@/components/screens/VehicleTypePicker';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { useVehicleDocumentUpload, useVehicleDocuments } from '@/hooks/useVehicleDocuments';
import { ApiError } from '@/services/api/ApiError';
import type { VehicleType } from '@/types/vehicles.types';

/** Deuxième étape affichée juste après la création — le véhicule existe déjà en base, seuls ses documents manquent avant validation. */
function VehicleDocumentsStep({ vehicleId }: { vehicleId: string }) {
  const { data: documents } = useVehicleDocuments(vehicleId);
  const upload = useVehicleDocumentUpload(vehicleId);

  const registrationDoc = documents?.find((d) => d.type === 'vehicle_registration');
  const insuranceDoc = documents?.find((d) => d.type === 'vehicle_insurance');

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader title="Documents du véhicule" subtitle="Dernière étape" onBack={() => router.back()} />

      <AppText variant="sm" color="textSecondary" style={styles.intro}>
        Véhicule ajouté. Envoyez sa carte grise et son assurance pour qu&apos;il soit validé par notre équipe.
      </AppText>

      <View style={styles.docs}>
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

      <OceanButton label="Terminer" onPress={() => router.back()} style={styles.submit} />
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
      <OceanScreenHeader title="Ajouter un véhicule" onBack={() => router.back()} />

      <View style={styles.sections}>
        <OceanSection icon={<IconFileText size={17} color={OCEAN.base} />} title="Informations">
          <View style={styles.row}>
            <View style={styles.cell}>
              <TextField
                label="Marque"
                value={brand}
                onChangeText={setBrand}
                placeholder="Toyota"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.cell}>
              <TextField
                label="Modèle"
                value={model}
                onChangeText={setModel}
                placeholder="Corolla"
                autoCapitalize="words"
              />
            </View>
          </View>
          <TextField
            label="Couleur (optionnel)"
            value={color}
            onChangeText={setColor}
            placeholder="Gris"
            autoCapitalize="words"
          />
          <TextField
            label="Plaque d'immatriculation"
            value={plateNumber}
            onChangeText={setPlateNumber}
            placeholder="RC-1234-GN"
            autoCapitalize="characters"
          />
        </OceanSection>

        <OceanSection icon={<IconSteeringWheel size={17} color={OCEAN.base} />} title="Type et capacité">
          <VehicleTypePicker value={type} onChange={setType} />
          <SeatsStepper value={totalSeats} onChange={setTotalSeats} />
        </OceanSection>
      </View>

      {errorMessage ? (
        <View style={styles.errorBox} accessibilityLiveRegion="polite">
          <AppText variant="sm" color="dangerDark">
            {errorMessage}
          </AppText>
        </View>
      ) : null}

      <OceanButton
        label="Ajouter le véhicule"
        onPress={handleSubmit}
        loading={createVehicle.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginBottom: spacing.lg,
  },
  sections: {
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
  },
  docs: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});