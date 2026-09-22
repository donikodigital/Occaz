// mobile/src/components/screens/VehicleDetailModal.tsx
// [21/09/2026] v2 — habillage bleu Ocean : bandeau, sections et bouton Enregistrer comme le reste du profil chauffeur.
import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconCar, IconCheck, IconFileText, IconLock, IconSteeringWheel, IconX } from '@tabler/icons-react-native';
import { AppText, Badge, DocumentUploadField, IconButton, TextField } from '@/components/ui';
import { OceanButton, OceanSection } from '@/components/ocean/OceanKit';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useUpdateVehicle } from '@/hooks/useVehicles';
import { useVehicleDocumentUpload, useVehicleDocuments } from '@/hooks/useVehicleDocuments';
import { VEHICLE_TYPE_LABELS } from '@/utils/vehicleLabels';
import { ApiError } from '@/services/api/ApiError';
import type { Vehicle, VehicleType } from '@/types/vehicles.types';
import { SeatsStepper } from './SeatsStepper';
import { VEHICLE_TYPE_ICONS, VehicleTypePicker } from './VehicleTypePicker';

export interface VehicleDetailModalProps {
  vehicle: Vehicle | null;
  onClose: () => void;
}

const STATUS_LABEL: Record<Vehicle['verificationStatus'], string> = {
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté',
  PENDING: 'En attente',
};
const STATUS_TONE: Record<Vehicle['verificationStatus'], 'success' | 'danger' | 'accent'> = {
  VERIFIED: 'success',
  REJECTED: 'danger',
  PENDING: 'accent',
};

const HERO_ICON_BG = 'rgba(255,255,255,0.16)';

/** Champs modifiables — sert à savoir si quelque chose a changé (bouton Enregistrer). */
interface VehicleFields {
  brand: string;
  model: string;
  color: string;
  type: VehicleType;
  totalSeats: number;
}

function fieldsFromVehicle(vehicle: Vehicle): VehicleFields {
  return {
    brand: vehicle.brand,
    model: vehicle.model,
    color: vehicle.color ?? '',
    type: vehicle.type,
    totalSeats: vehicle.totalSeats,
  };
}

function VehicleDetailContent({ vehicle, onClose }: { vehicle: Vehicle; onClose: () => void }) {
  const [brand, setBrand] = useState(vehicle.brand);
  const [model, setModel] = useState(vehicle.model);
  const [color, setColor] = useState(vehicle.color ?? '');
  const [type, setType] = useState<VehicleType>(vehicle.type);
  const [totalSeats, setTotalSeats] = useState(vehicle.totalSeats);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  /**
   * Valeurs enregistrées pendant cette ouverture. `vehicle` est un instantané
   * pris à l'ouverture depuis l'écran Profil : il ne se met pas à jour après
   * un enregistrement, donc on garde ici la nouvelle référence de comparaison.
   */
  const [saved, setSaved] = useState<VehicleFields | null>(null);

  const updateVehicle = useUpdateVehicle(vehicle.id);
  const { data: documents } = useVehicleDocuments(vehicle.id);
  const upload = useVehicleDocumentUpload(vehicle.id);

  const registrationDoc = documents?.find((d) => d.type === 'vehicle_registration');
  const insuranceDoc = documents?.find((d) => d.type === 'vehicle_insurance');

  const current: VehicleFields = { brand: brand.trim(), model: model.trim(), color: color.trim(), type, totalSeats };
  const baseline = saved ?? fieldsFromVehicle(vehicle);
  const isDirty = (Object.keys(current) as (keyof VehicleFields)[]).some((key) => current[key] !== baseline[key]);
  const justSaved = saved !== null && !isDirty;

  const TypeIcon = VEHICLE_TYPE_ICONS[type];
  const title = `${brand} ${model}`.trim() || 'Véhicule';
  const subtitle = `${VEHICLE_TYPE_LABELS[type]}, ${totalSeats} ${totalSeats > 1 ? 'places' : 'place'}`;

  function handleSave() {
    setErrorMessage(undefined);
    if (current.brand.length < 1 || current.model.length < 1) {
      setErrorMessage('Renseignez la marque et le modèle.');
      return;
    }
    updateVehicle.mutate(
      {
        brand: current.brand,
        model: current.model,
        color: current.color || undefined,
        type: current.type,
        totalSeats: current.totalSeats,
      },
      {
        onSuccess: () => setSaved(current),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.topBar}>
            <AppText variant="lg" weight="bold" color={OCEAN.deep}>
              Mon véhicule
            </AppText>
            <IconButton
              icon={<IconX size={18} color={OCEAN.base} />}
              accessibilityLabel="Fermer"
              onPress={onClose}
            />
          </View>

          {/* En-tête : se met à jour en direct pendant la saisie. La plaque est le point fort de l'écran. */}
          <View style={styles.hero}>
            <View style={styles.heroRow}>
              <View style={styles.heroIcon}>
                <TypeIcon size={28} color={colors.onPrimary} strokeWidth={1.7} />
              </View>
              <View style={styles.heroText}>
                <AppText variant="xl" weight="bold" color={OCEAN.onDark} numberOfLines={1}>
                  {title}
                </AppText>
                <AppText variant="sm" color={OCEAN.sky}>
                  {subtitle}
                </AppText>
              </View>
            </View>

            <View style={styles.plateRow}>
              <View
                style={styles.plate}
                accessible
                accessibilityLabel={`Plaque ${vehicle.plateNumber}, non modifiable`}
              >
                <AppText variant="md" weight="bold" style={styles.plateText}>
                  {vehicle.plateNumber}
                </AppText>
                <IconLock size={13} color={colors.textMuted} />
              </View>
              <Badge
                label={STATUS_LABEL[vehicle.verificationStatus]}
                tone={STATUS_TONE[vehicle.verificationStatus]}
              />
            </View>
          </View>

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
          </OceanSection>

          <OceanSection icon={<IconSteeringWheel size={17} color={OCEAN.base} />} title="Type et capacité">
            <VehicleTypePicker value={type} onChange={setType} />
            <SeatsStepper value={totalSeats} onChange={setTotalSeats} />
          </OceanSection>

          <OceanSection icon={<IconCar size={17} color={OCEAN.base} />} title="Documents">
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
          </OceanSection>
        </View>
      </ScrollView>

      {/* Barre d'action fixe : toujours visible, active seulement s'il y a une modification. */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.footerInner}>
          {errorMessage ? (
            <View style={styles.errorBox} accessibilityLiveRegion="polite">
              <AppText variant="sm" color="dangerDark">
                {errorMessage}
              </AppText>
            </View>
          ) : null}
          <OceanButton
            label={justSaved ? 'Enregistré' : 'Enregistrer'}
            icon={justSaved ? <IconCheck size={18} color={OCEAN.onDark} /> : undefined}
            onPress={handleSave}
            loading={updateVehicle.isPending}
            disabled={!isDirty}
          />
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

/**
 * Détail + modification d'un véhicule, ouvert depuis la carte véhicule de
 * l'écran Profil. La plaque d'immatriculation reste en lecture seule
 * (même restriction que côté backend — voir UpdateVehicleDto, "risque de
 * fraude") ; tout le reste (marque, modèle, couleur, type, places) est
 * modifiable, plus l'envoi des documents (carte grise, assurance) via les
 * mêmes hooks que vehicle-new.tsx.
 *
 * Le contenu est un composant à part, monté avec `key={vehicle.id}` : les
 * champs sont initialisés directement depuis le véhicule (plus de
 * useEffect, donc plus de flash de champs vides à l'ouverture).
 */
export function VehicleDetailModal({ vehicle, onClose }: VehicleDetailModalProps) {
  if (!vehicle) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <VehicleDetailContent key={vehicle.id} vehicle={vehicle} onClose={onClose} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  /** Sur desktop (web), le contenu ne s'étire pas sur tout l'écran. */
  inner: {
    width: '100%',
    maxWidth: maxContentWidth.form,
    alignSelf: 'center',
    gap: spacing.xl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -spacing.xs,
  },

  // --- En-tête ---
  hero: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: OCEAN.deep,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: HERO_ICON_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
  },
  plateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  plate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  plateText: {
    letterSpacing: 1.5,
  },

  // --- Sections ---
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
  },

  // --- Barre d'action ---
  footer: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  footerInner: {
    width: '100%',
    maxWidth: maxContentWidth.form,
    alignSelf: 'center',
    gap: spacing.sm,
  },
  errorBox: {
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
  },
});