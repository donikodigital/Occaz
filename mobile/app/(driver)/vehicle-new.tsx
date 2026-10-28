// mobile/app/(driver)/vehicle-new.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
// [21/09/2026] v2 — habillage bleu Ocean (en-tête, sections), comme la modale de modification du véhicule.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCar, IconFileText, IconSteeringWheel } from '@tabler/icons-react-native';
import { AppText, DocumentUploadField, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanSection } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { SeatsStepper } from '@/components/screens/SeatsStepper';
import { VehicleTypePicker } from '@/components/screens/VehicleTypePicker';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCreateVehicle } from '@/hooks/useVehicles';
import { useVehicleDocumentUpload, useVehicleDocuments } from '@/hooks/useVehicleDocuments';
import { ApiError } from '@/services/api/ApiError';
import type { VehicleType } from '@/types/vehicles.types';
import { useT } from '@/i18n';

/** Deuxième étape affichée juste après la création — le véhicule existe déjà en base, seuls ses documents manquent avant validation. */
function VehicleDocumentsStep({ vehicleId }: { vehicleId: string }) {
  const t = useT();
  const { data: documents } = useVehicleDocuments(vehicleId);
  const upload = useVehicleDocumentUpload(vehicleId);

  const registrationDoc = documents?.find((d) => d.type === 'vehicle_registration');
  const insuranceDoc = documents?.find((d) => d.type === 'vehicle_insurance');

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Documents du véhicule')} subtitle={t('Dernière étape')} icon={<IconFileText />} onBack={() => router.back()} />

      <AppText variant="sm" color="textSecondary" style={styles.intro}>
        {t("Véhicule ajouté. Envoyez sa carte grise et son assurance pour qu'il soit validé par notre équipe.")}
      </AppText>

      <View style={styles.docs}>
        <DocumentUploadField
          label={t('Carte grise')}
          document={registrationDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('vehicle_registration')}
          errorMessage={upload.errorFor('vehicle_registration')}
          onPickCamera={() => upload.pickFromCamera('vehicle_registration')}
        />
        <DocumentUploadField
          label={t('Assurance')}
          document={insuranceDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('vehicle_insurance')}
          errorMessage={upload.errorFor('vehicle_insurance')}
          onPickCamera={() => upload.pickFromCamera('vehicle_insurance')}
        />
      </View>

      <OceanButton label={t('Terminer')} onPress={() => router.back()} style={styles.submit} />
    </ScreenContainer>
  );
}

export default function NewVehicleScreen() {
  const t = useT();
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
      setErrorMessage(t('Renseignez la marque et le modèle.'));
      return;
    }
    if (plateNumber.trim().length < 3) {
      setErrorMessage(t("Renseignez la plaque d'immatriculation."));
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
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue.'));
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Ajouter un véhicule')} subtitle={t('Renseignez votre véhicule')} icon={<IconCar />} onBack={() => router.back()} />

      <View style={styles.sections}>
        <OceanSection icon={<IconFileText size={17} color={OCEAN.base} />} title={t('Informations')}>
          <View style={styles.row}>
            <View style={styles.cell}>
              <TextField
                label={t('Marque')}
                value={brand}
                onChangeText={setBrand}
                placeholder={t('Toyota')}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.cell}>
              <TextField
                label={t('Modèle')}
                value={model}
                onChangeText={setModel}
                placeholder={t('Corolla')}
                autoCapitalize="words"
              />
            </View>
          </View>
          <TextField
            label={t('Couleur (optionnel)')}
            value={color}
            onChangeText={setColor}
            placeholder={t('Gris')}
            autoCapitalize="words"
          />
          <TextField
            label={t("Plaque d'immatriculation")}
            value={plateNumber}
            onChangeText={setPlateNumber}
            placeholder={t('RC-1234-GN')}
            autoCapitalize="characters"
          />
        </OceanSection>

        <OceanSection icon={<IconSteeringWheel size={17} color={OCEAN.base} />} title={t('Type et capacité')}>
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
        label={t('Ajouter le véhicule')}
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
