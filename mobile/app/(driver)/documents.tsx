// mobile/app/(driver)/documents.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [19/10/2026] v1 — « Mon dossier » : l'endroit où un conducteur déjà inscrit envoie (ou renvoie) ses pièces : photo, permis, carte grise du
// véhicule, et ajoute un véhicule s'il n'en a pas. Un bandeau rappelle les jours restants avant le blocage de la création de trajets.
// Les envois échoués s'affichent sous le champ concerné (pas d'Alert.alert).
// [23/10/2026] v2 — chaque pièce non vérifiée (permis, pièce d'identité, carte grise) peut être supprimée, avec confirmation.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCar, IconFileCheck, IconId } from '@tabler/icons-react-native';
import { AppText, DocumentUploadField, FeedbackBanner, ProfilePhotoField, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { DriverComplianceBanner } from '@/components/screens/DriverComplianceBanner';
import { spacing } from '@/theme';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { useDriverCompliance } from '@/hooks/useDriverCompliance';
import { useDeleteDriverDocument, useDriverDocumentUpload, useMyDriverDocuments } from '@/hooks/useDriverDocuments';
import { useDriverPhotoUpload } from '@/hooks/useDriverPhotoUpload';
import { useMyVehicles } from '@/hooks/useVehicles';
import { useDeleteVehicleDocument, useVehicleDocumentUpload, useVehicleDocuments } from '@/hooks/useVehicleDocuments';
import { useQueryClient } from '@tanstack/react-query';
import type { Vehicle } from '@/types/vehicles.types';
import { useT } from '@/i18n';

function VehicleRegistrationField({ vehicle }: { vehicle: Vehicle }) {
  const t = useT();
  const { data: documents } = useVehicleDocuments(vehicle.id);
  const upload = useVehicleDocumentUpload(vehicle.id);
  const remove = useDeleteVehicleDocument(vehicle.id);
  const registrationDoc = documents?.find((d) => d.type === 'vehicle_registration');
  return (
    <DocumentUploadField
      label={t('Carte grise · {brand} {model}', { brand: vehicle.brand, model: vehicle.model })}
      document={registrationDoc}
      isUploading={upload.isUploading}
      onPickLibrary={() => upload.pickFromLibrary('vehicle_registration')}
      onPickCamera={() => upload.pickFromCamera('vehicle_registration')}
      errorMessage={upload.errorFor('vehicle_registration')}
      onDelete={registrationDoc ? () => remove.mutate(registrationDoc.id) : undefined}
      isDeleting={remove.isPending}
      deleteError={remove.isError ? remove.error.message : null}
    />
  );
}

export default function DriverDocumentsScreen() {
  const t = useT();
  const queryClient = useQueryClient();
  const { data: profile } = useDriverProfile();
  const { data: compliance } = useDriverCompliance();
  const { data: documents } = useMyDriverDocuments();
  const { data: vehicles } = useMyVehicles();
  const upload = useDriverDocumentUpload();
  const remove = useDeleteDriverDocument();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const photoUpload = useDriverPhotoUpload((updated) => {
    setPhotoUrl(updated.photoUrl);
    void queryClient.invalidateQueries({ queryKey: ['driver-compliance', 'mine'] });
  });

  const licenseDoc = documents?.find((d) => d.type === 'driver_license');
  const nationalIdDoc = documents?.find((d) => d.type === 'national_id');
  const initials = profile ? `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}` : '?';
  const hasVehicle = Boolean(vehicles && vehicles.length > 0);
  /** Props de suppression d'une pièce : le chargement et l'erreur ne concernent que la pièce visée. */
  const deletion = (doc: { id: string } | undefined) => ({
    onDelete: doc ? () => remove.mutate(doc.id) : undefined,
    isDeleting: remove.isPending && remove.variables === doc?.id,
    deleteError: remove.isError && remove.variables === doc?.id ? remove.error.message : null,
  });

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader title={t('Mon dossier')} subtitle={t('Pièces à fournir pour valider votre compte')} onBack={() => router.back()} />

      <View style={styles.block}>
        <DriverComplianceBanner />
        {compliance?.isCompliant ? (
          <FeedbackBanner tone="success" text={t('Votre dossier est validé : trajets et colis sont ouverts.')} />
        ) : null}
        {compliance?.blockedReason && compliance.status !== 'PENDING' && compliance.status !== 'IN_VERIFICATION' ? (
          <FeedbackBanner tone="error" text={compliance.blockedReason} />
        ) : null}
      </View>

      <OceanSection icon={<IconId size={17} color="#0B6BA8" />} title={t('Vous')}>
        <ProfilePhotoField
          photoUrl={photoUrl ?? profile?.photoUrl}
          initials={initials}
          isUploading={photoUpload.isUploading}
          onPickLibrary={photoUpload.pickFromLibrary}
          onPickCamera={photoUpload.pickFromCamera}
          errorMessage={photoUpload.error}
          isRequired
        />
        <DocumentUploadField
          label={t('Permis de conduire')}
          document={licenseDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('driver_license')}
          onPickCamera={() => upload.pickFromCamera('driver_license')}
          errorMessage={upload.errorFor('driver_license')}
          {...deletion(licenseDoc)}
        />
        <DocumentUploadField
          label={t("Carte nationale d'identité")}
          document={nationalIdDoc}
          isUploading={upload.isUploading}
          onPickLibrary={() => upload.pickFromLibrary('national_id')}
          onPickCamera={() => upload.pickFromCamera('national_id')}
          errorMessage={upload.errorFor('national_id')}
          {...deletion(nationalIdDoc)}
        />
      </OceanSection>

      <OceanSection icon={<IconCar size={17} color="#0B6BA8" />} title={t('Votre véhicule')}>
        {hasVehicle ? (
          vehicles!.map((vehicle) => <VehicleRegistrationField key={vehicle.id} vehicle={vehicle} />)
        ) : (
          <>
            <AppText variant="sm" color="textSecondary">
              {t('Aucun véhicule enregistré. Ajoutez-en un, puis envoyez sa carte grise.')}
            </AppText>
            <OceanButton label={t('Ajouter un véhicule')} onPress={() => router.push('/(driver)/vehicle-new')} style={styles.addVehicle} />
          </>
        )}
      </OceanSection>

      <OceanSection icon={<IconFileCheck size={17} color="#0B6BA8" />} title={t('Et ensuite ?')}>
        <AppText variant="sm" color="textSecondary">
          {t("Une fois toutes les pièces envoyées, notre équipe les examine. Vous pouvez créer des trajets de passagers en attendant ; les colis s'ouvrent dès la validation de votre compte.")}
        </AppText>
      </OceanSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm, marginBottom: spacing.md },
  addVehicle: { marginTop: spacing.sm },
});
