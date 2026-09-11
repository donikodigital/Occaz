// mobile/app/(customer)/shipment-new.tsx
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertCircle,
  IconArrowLeft,
  IconMapPin,
  IconMinus,
  IconPlus,
} from '@tabler/icons-react-native';
import { AppText, Button, Card, Divider, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useShipmentCategories } from '@/hooks/useShipmentCategories';
import { useCreateShipment } from '@/hooks/useShipments';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { normalizePhoneInput } from '@/utils/phone';
import { ApiError } from '@/services/api/ApiError';
import type { TripLocation } from '@/types/trips.types';

export default function NewShipmentScreen() {
  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('+224');
  const [senderLocation, setSenderLocation] = useState<TripLocation | null>(null);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+224');
  const [recipientLocation, setRecipientLocation] = useState<TripLocation | null>(null);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [declaredValue, setDeclaredValue] = useState('');
  const [description, setDescription] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const { data: categories } = useShipmentCategories();
  const createShipment = useCreateShipment();

  const locationSelection = useLocationSelectionStore((state) => state.selection);
  const consumeLocationSelection = useLocationSelectionStore((state) => state.consume);
  const openLocationPicker = useLocationSelectionStore((state) => state.openFor);

  useEffect(() => {
    if (!locationSelection) return;
    if (locationSelection.field === 'sender') setSenderLocation(locationSelection.location);
    else setRecipientLocation(locationSelection.location);
    consumeLocationSelection();
  }, [locationSelection, consumeLocationSelection]);

  function openAddressPicker(field: 'sender' | 'recipient') {
    openLocationPicker(field);
    router.push({
      pathname: '/(customer)/select-location',
      params: { title: field === 'sender' ? 'Adresse de récupération' : 'Adresse de livraison' },
    });
  }

  function handleSubmit() {
    setErrorMessage(undefined);

    if (senderName.trim().length < 2 || recipientName.trim().length < 2) {
      setErrorMessage("Renseignez le nom de l'expéditeur et du destinataire.");
      return;
    }
    if (!senderLocation || !recipientLocation) {
      setErrorMessage("Renseignez l'adresse de récupération et de livraison.");
      return;
    }
    if (!categoryId) {
      setErrorMessage('Choisissez une catégorie de colis.');
      return;
    }
    const weight = Number(weightKg.replace(',', '.'));
    if (!Number.isFinite(weight) || weight <= 0) {
      setErrorMessage('Indiquez le poids du colis.');
      return;
    }

    createShipment.mutate(
      {
        categoryId,
        senderName: senderName.trim(),
        senderPhone,
        senderLocationId: senderLocation.id,
        recipientName: recipientName.trim(),
        recipientPhone,
        recipientLocationId: recipientLocation.id,
        description: description.trim() || undefined,
        weightKg: weight,
        quantity,
        declaredValue: declaredValue.trim() || undefined,
        isUrgent,
      },
      {
        onSuccess: (shipment) => router.replace(`/(customer)/shipment/${shipment.id}`),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <AppText variant="lg" weight="semibold">
          Envoyer un colis
        </AppText>
        <View style={{ width: 38 }} />
      </View>

      <SectionTitle label="Expéditeur" />
      <View style={styles.fields}>
        <TextField label="Nom complet" value={senderName} onChangeText={setSenderName} placeholder="Nom de l'expéditeur" />
        <TextField
          label="Téléphone"
          value={senderPhone}
          onChangeText={(t) => setSenderPhone(normalizePhoneInput(t))}
          keyboardType="phone-pad"
          placeholder="+224620000000"
        />
        <AddressCard
          label="Adresse de récupération"
          location={senderLocation}
          onPress={() => openAddressPicker('sender')}
        />
      </View>

      <SectionTitle label="Destinataire" />
      <View style={styles.fields}>
        <TextField
          label="Nom complet"
          value={recipientName}
          onChangeText={setRecipientName}
          placeholder="Nom du destinataire"
        />
        <TextField
          label="Téléphone"
          value={recipientPhone}
          onChangeText={(t) => setRecipientPhone(normalizePhoneInput(t))}
          keyboardType="phone-pad"
          placeholder="+224620000000"
        />
        <AddressCard
          label="Adresse de livraison"
          location={recipientLocation}
          onPress={() => openAddressPicker('recipient')}
        />
      </View>

      <SectionTitle label="Colis" />
      <View style={styles.categoryRow}>
        {(categories ?? []).map((category) => {
          const isActive = category.id === categoryId;
          return (
            <Pressable
              key={category.id}
              onPress={() => setCategoryId(category.id)}
              style={[styles.categoryChip, isActive && styles.categoryChipActive]}
            >
              <AppText variant="sm" weight="medium" color={isActive ? colors.onPrimary : 'textPrimary'}>
                {category.name}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.fields}>
        <TextField
          label="Poids (kg)"
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
          placeholder="Ex : 3"
        />

        <View>
          <AppText variant="sm" weight="medium" color="textSecondary" style={styles.stepperLabel}>
            Quantité
          </AppText>
          <View style={styles.stepper}>
            <IconButton
              icon={<IconMinus size={16} color={colors.textPrimary} />}
              accessibilityLabel="Retirer"
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
            />
            <AppText variant="lg" weight="semibold" style={styles.stepperValue}>
              {quantity}
            </AppText>
            <IconButton
              icon={<IconPlus size={16} color={colors.textPrimary} />}
              accessibilityLabel="Ajouter"
              onPress={() => setQuantity((q) => Math.min(20, q + 1))}
            />
          </View>
        </View>

        <TextField
          label="Valeur déclarée (optionnel)"
          value={declaredValue}
          onChangeText={setDeclaredValue}
          keyboardType="numeric"
          placeholder="En GNF"
        />

        <TextField
          label="Description (optionnel)"
          value={description}
          onChangeText={setDescription}
          placeholder="Contenu du colis"
          multiline
          style={styles.multiline}
        />

        <Pressable onPress={() => setIsUrgent((v) => !v)} style={styles.urgentRow}>
          <View style={[styles.checkbox, isUrgent && styles.checkboxActive]}>
            {isUrgent ? <IconAlertCircle size={13} color={colors.onAccent} /> : null}
          </View>
          <AppText variant="sm">Envoi urgent</AppText>
        </Pressable>
      </View>

      <Card style={styles.noticeCard}>
        <AppText variant="xs" color="textMuted">
          Le prix exact est calculé à la validation, selon le poids, la distance et la catégorie choisie.
        </AppText>
      </Card>

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <Button
        label="Confirmer l'envoi"
        onPress={handleSubmit}
        loading={createShipment.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
      {label}
    </AppText>
  );
}

function AddressCard({
  label,
  location,
  onPress,
}: {
  label: string;
  location: TripLocation | null;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.addressCard}>
      <View style={styles.addressRow}>
        <IconMapPin size={16} color={location ? colors.successDark : colors.textSecondary} />
        <View style={{ flex: 1 }}>
          <AppText variant="xs" color="textSecondary">
            {label}
          </AppText>
          <AppText variant="sm" weight="medium" numberOfLines={1}>
            {location ? location.label : 'Appuyez pour choisir'}
          </AppText>
        </View>
      </View>
    </Card>
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
  sectionTitle: {
    marginBottom: spacing.sm,
    marginTop: spacing.xs,
  },
  fields: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  addressCard: {
    padding: spacing.sm + 2,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  categoryChip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  urgentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  noticeCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.surfaceMuted,
    marginBottom: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.md,
  },
});
