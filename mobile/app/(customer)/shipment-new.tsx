// mobile/app/(customer)/shipment-new.tsx
// [23/09/2026] v4 — champ « Code promo », entre les informations du colis et le devis en direct.
// [21/09/2026] v3 — Habillage bleu océan ; logique inchangée : plage de dates obligatoire, dimensions, prix calculé par le serveur.
//
// Le formulaire est découpé en sections à en-tête soulignée (Expéditeur,
// Destinataire, Colis, Période), avec des puces pour la catégorie, un
// stepper pour la quantité et un interrupteur pour « Envoi urgent ». Le
// devis en direct (ShipmentQuoteCard) reste au-dessus du bouton.

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconMapPin,
  IconPackage,
  IconUser,
  IconUserCheck,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import {
  OceanButton,
  OceanCard,
  OceanChip,
  OceanScreenHeader,
  OceanSection,
  OceanStepper,
  OceanSwitchRow,
} from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { ShipmentQuoteCard } from '@/components/screens/ShipmentQuoteCard';
import { ShipmentWindowField, toShipmentWindow } from '@/components/screens/ShipmentWindowField';
import { PromoCodeField } from '@/components/screens/PromoCodeField';
import { useShipmentCategories } from '@/hooks/useShipmentCategories';
import { useCreateShipment, useShipmentQuote } from '@/hooks/useShipments';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useAuthStore } from '@/stores/authStore';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { normalizePhoneInput } from '@/utils/phone';
import { ApiError } from '@/services/api/ApiError';
import type { QuoteShipmentPayload } from '@/types/shipments.types';
import type { TripLocation } from '@/types/trips.types';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
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
    <OceanCard onPress={onPress} style={styles.addressCard} accessibilityLabel={label}>
      <View style={[styles.addressIcon, location && styles.addressIconDone]}>
        {location ? <IconCheck size={16} color={colors.successDark} /> : <IconMapPin size={16} color={OCEAN.base} />}
      </View>
      <View style={styles.addressText}>
        <AppText variant="xs" color="textSecondary">
          {label}
        </AppText>
        <AppText variant="sm" weight="semibold" numberOfLines={1} color={location ? 'textPrimary' : OCEAN.base}>
          {location ? location.label : 'Appuyez pour choisir'}
        </AppText>
      </View>
      <IconChevronRight size={16} color={colors.textMuted} />
    </OceanCard>
  );
}

export default function NewShipmentScreen() {
  const { data: profile } = useCustomerProfile();
  const accountUser = useAuthStore((state) => state.user);

  const [senderName, setSenderName] = useState('');
  const [senderPhone, setSenderPhone] = useState('+224');
  const [senderLocation, setSenderLocation] = useState<TripLocation | null>(null);

  // Pré-remplies dès que le profil/compte est chargé, mais seulement si le
  // client n'a pas déjà modifié le champ lui-même (utile s'il envoie le
  // colis pour quelqu'un d'autre) — un champ non vide n'est jamais écrasé.
  useEffect(() => {
    if (senderName === '' && profile) {
      setSenderName(`${profile.firstName} ${profile.lastName}`.trim());
    }
  }, [profile, senderName]);

  useEffect(() => {
    if (senderPhone === '+224' && accountUser?.phone) {
      setSenderPhone(normalizePhoneInput(accountUser.phone));
    }
  }, [accountUser, senderPhone]);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('+224');
  const [recipientLocation, setRecipientLocation] = useState<TripLocation | null>(null);

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [weightKg, setWeightKg] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [lengthCm, setLengthCm] = useState('');
  const [widthCm, setWidthCm] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [declaredValue, setDeclaredValue] = useState('');
  const [description, setDescription] = useState('');
  const [windowStart, setWindowStart] = useState<Date | null>(null);
  const [windowEnd, setWindowEnd] = useState<Date | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [promoCode, setPromoCode] = useState<string | undefined>();
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

  // Devis en direct : `null` tant que adresses, catégorie et poids ne sont pas tous renseignés.
  const quotePayload = useMemo<QuoteShipmentPayload | null>(() => {
    const weight = Number(weightKg.replace(',', '.'));
    if (!senderLocation || !recipientLocation || !categoryId || !Number.isFinite(weight) || weight <= 0) return null;
    const dimensions = [lengthCm, widthCm, heightCm].map((value) => Number(value.replace(',', '.')));
    const hasDimensions = dimensions.every((value) => Number.isFinite(value) && value > 0);
    const declared = declaredValue.replace(/\D/g, '');
    return {
      categoryId,
      senderLocationId: senderLocation.id,
      recipientLocationId: recipientLocation.id,
      weightKg: weight,
      ...(hasDimensions ? { lengthCm: dimensions[0], widthCm: dimensions[1], heightCm: dimensions[2] } : {}),
      quantity,
      ...(declared ? { declaredValue: declared } : {}),
      isUrgent,
    };
  }, [senderLocation, recipientLocation, categoryId, weightKg, lengthCm, widthCm, heightCm, quantity, declaredValue, isUrgent]);

  // Même débounce que ShipmentQuoteCard (500 ms) : même clé de requête, donc
  // pas d'appel réseau supplémentaire — seulement un second abonnement au
  // même devis, pour connaître le montant à passer au champ code promo.
  const debouncedQuotePayload = useDebouncedValue(quotePayload, 500);
  const { data: quote } = useShipmentQuote(debouncedQuotePayload);

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
    if (!windowStart || !windowEnd) {
      setErrorMessage('Indiquez la période pendant laquelle le colis peut partir.');
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
        ...(quotePayload?.lengthCm !== undefined
          ? { lengthCm: quotePayload.lengthCm, widthCm: quotePayload.widthCm, heightCm: quotePayload.heightCm }
          : {}),
        quantity,
        declaredValue: declaredValue.replace(/\D/g, '') || undefined,
        isUrgent,
        ...toShipmentWindow(windowStart, windowEnd),
        promoCode,
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
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Envoyer un colis" subtitle="Remplissez les 4 étapes ci-dessous" onBack={() => router.back()} />

      <OceanSection icon={<IconUser size={17} color={OCEAN.base} />} title="Expéditeur">
        <TextField label="Nom complet" value={senderName} onChangeText={setSenderName} placeholder="Nom de l'expéditeur" />
        <TextField
          label="Téléphone"
          value={senderPhone}
          onChangeText={(t) => setSenderPhone(normalizePhoneInput(t))}
          keyboardType="phone-pad"
          placeholder="+224620000000"
        />
        <AddressCard label="Adresse de récupération" location={senderLocation} onPress={() => openAddressPicker('sender')} />
      </OceanSection>

      <OceanSection icon={<IconUserCheck size={17} color={OCEAN.base} />} title="Destinataire">
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
        <AddressCard label="Adresse de livraison" location={recipientLocation} onPress={() => openAddressPicker('recipient')} />
      </OceanSection>

      <OceanSection icon={<IconPackage size={17} color={OCEAN.base} />} title="Colis">
        <View style={styles.block}>
          <AppText variant="sm" weight="medium" color="textSecondary">
            Catégorie
          </AppText>
          <View style={styles.categoryRow}>
            {(categories ?? []).map((category) => (
              <OceanChip
                key={category.id}
                label={category.name}
                active={category.id === categoryId}
                onPress={() => setCategoryId(category.id)}
              />
            ))}
          </View>
        </View>

        <TextField
          label="Poids (kg)"
          value={weightKg}
          onChangeText={setWeightKg}
          keyboardType="decimal-pad"
          placeholder="Ex : 3"
        />

        <View style={styles.block}>
          <AppText variant="sm" weight="medium" color="textSecondary">
            Quantité
          </AppText>
          <OceanStepper value={quantity} onChange={setQuantity} min={1} max={20} label="quantité" />
        </View>

        <View style={styles.block}>
          <AppText variant="sm" weight="medium" color="textSecondary">
            Dimensions d'un colis, en cm (optionnel)
          </AppText>
          <View style={styles.dimensionsRow}>
            <View style={styles.dimensionCell}>
              <TextField value={lengthCm} onChangeText={setLengthCm} keyboardType="decimal-pad" placeholder="Long." />
            </View>
            <View style={styles.dimensionCell}>
              <TextField value={widthCm} onChangeText={setWidthCm} keyboardType="decimal-pad" placeholder="Larg." />
            </View>
            <View style={styles.dimensionCell}>
              <TextField value={heightCm} onChangeText={setHeightCm} keyboardType="decimal-pad" placeholder="Haut." />
            </View>
          </View>
        </View>

        <TextField
          label="Valeur déclarée (optionnel)"
          value={declaredValue}
          onChangeText={setDeclaredValue}
          keyboardType="numeric"
          placeholder="Montant en chiffres"
        />

        <TextField
          label="Description (optionnel)"
          value={description}
          onChangeText={setDescription}
          placeholder="Contenu du colis"
          multiline
          style={styles.multiline}
        />

        <OceanSwitchRow
          value={isUrgent}
          onChange={setIsUrgent}
          label="Envoi urgent"
          description="Une majoration peut s’appliquer au prix — voir le devis."
          icon={<IconAlertCircle size={18} color={OCEAN.base} />}
        />
      </OceanSection>

      <OceanSection icon={<IconCalendarEvent size={17} color={OCEAN.base} />} title="Période">
        <ShipmentWindowField
          startDate={windowStart}
          endDate={windowEnd}
          onChangeStart={setWindowStart}
          onChangeEnd={setWindowEnd}
        />
      </OceanSection>

      <View style={styles.promoField}>
        <PromoCodeField serviceType="SHIPMENT" amount={quote?.totalAmount ?? null} appliedCode={promoCode} onChange={setPromoCode} />
      </View>

      <ShipmentQuoteCard payload={quotePayload} />

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      <OceanButton label="Confirmer l'envoi" onPress={handleSubmit} loading={createShipment.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  addressCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
  },
  addressIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addressIconDone: {
    backgroundColor: colors.successLight,
  },
  addressText: {
    flex: 1,
    gap: 2,
  },
  block: {
    gap: spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  dimensionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  dimensionCell: {
    flex: 1,
  },
  multiline: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  promoField: {
    marginBottom: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
});