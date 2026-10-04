// mobile/app/(customer)/shipment-new.tsx
// [04/10/2026] v5 — Expéditeur verrouillé : nom, téléphone et adresse viennent du profil et ne se modifient que dans le profil
// (le serveur impose lui aussi le nom et le téléphone). L'adresse de récupération reste modifiable, pré-remplie avec l'adresse
// du profil ; « Utiliser l'adresse de mon profil » la rétablit. Les adresses affichent leur ville et leur pays.
// [23/09/2026] v4 — champ « Code promo », entre les informations du colis et le devis en direct.
// [21/09/2026] v3 — Habillage bleu océan ; logique inchangée : plage de dates obligatoire, dimensions, prix calculé par le serveur.
//
// Le formulaire est découpé en sections à en-tête soulignée (Expéditeur,
// Destinataire, Colis, Période), avec des puces pour la catégorie, un
// stepper pour la quantité et un interrupteur pour « Envoi urgent ». Le
// devis en direct (ShipmentQuoteCard) reste au-dessus du bouton.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconLock,
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
import { LockedField } from '@/components/screens/LockedField';
import { useShipmentCategories } from '@/hooks/useShipmentCategories';
import { useCreateShipment, useShipmentQuote } from '@/hooks/useShipments';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useAuthStore } from '@/stores/authStore';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { normalizePhoneInput } from '@/utils/phone';
import { formatCityCountry } from '@/utils/shipmentDisplay';
import { locationsApi } from '@/services/api/locations.api';
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
  tag,
}: {
  label: string;
  location: TripLocation | null;
  onPress: () => void;
  /** Petite mention à côté du libellé (ex. « Adresse du profil »). */
  tag?: string;
}) {
  return (
    <OceanCard onPress={onPress} style={styles.addressCard} accessibilityLabel={label}>
      <View style={[styles.addressIcon, location && styles.addressIconDone]}>
        {location ? <IconCheck size={16} color={colors.successDark} /> : <IconMapPin size={16} color={OCEAN.base} />}
      </View>
      <View style={styles.addressText}>
        <AppText variant="xs" color="textSecondary">
          {tag ? `${label} · ${tag}` : label}
        </AppText>
        <AppText variant="sm" weight="semibold" numberOfLines={1} color={location ? 'textPrimary' : OCEAN.base}>
          {location ? location.label : 'Appuyez pour choisir'}
        </AppText>
        {location && formatCityCountry(location) ? (
          <AppText variant="xs" color="textSecondary" numberOfLines={1}>
            {formatCityCountry(location)}
          </AppText>
        ) : null}
      </View>
      <IconChevronRight size={16} color={colors.textMuted} />
    </OceanCard>
  );
}

export default function NewShipmentScreen() {
  const { data: profile } = useCustomerProfile();
  const accountUser = useAuthStore((state) => state.user);

  // L'expéditeur, c'est le titulaire du compte : nom, téléphone et adresse viennent de son profil, en lecture seule.
  const senderName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';
  const senderPhone = accountUser?.phone ? normalizePhoneInput(accountUser.phone) : '';
  const profileAddress = profile?.address?.trim() ?? '';
  const profilePlace = [profile?.city?.name, profile?.country?.name].filter(Boolean).join(', ');
  const hasProfileAddress = profileAddress.length >= 3 && Boolean(profile?.cityId);

  const [senderLocation, setSenderLocation] = useState<TripLocation | null>(null);
  // Adresse du profil transformée en adresse de récupération, et vrai dès que le client en choisit une autre.
  const [profilePickup, setProfilePickup] = useState<TripLocation | null>(null);
  const [isCustomPickup, setIsCustomPickup] = useState(false);
  const profilePickupKey = useRef<string | null>(null);

  // Crée (ou retrouve, l'adresse étant dédoublonnée par le serveur) l'adresse de récupération correspondant à l'adresse du
  // profil. Les dépendances sont des valeurs simples : un rechargement du profil sans changement d'adresse ne relance rien.
  const profileCityId = profile?.cityId ?? null;
  useEffect(() => {
    if (!hasProfileAddress || !profileCityId) return;
    const key = `${profileAddress}|${profileCityId}`;
    if (profilePickupKey.current === key) return;
    profilePickupKey.current = key;
    let cancelled = false;
    locationsApi
      .create({ label: profileAddress, cityId: profileCityId, geocodeTrust: 'MANUAL' })
      .then((location) => {
        if (!cancelled) setProfilePickup(location);
      })
      .catch(() => {
        // Échec réseau : on réessaiera au prochain changement ; le client peut toujours choisir son adresse à la main.
        if (profilePickupKey.current === key) profilePickupKey.current = null;
      });
    return () => {
      cancelled = true;
    };
  }, [hasProfileAddress, profileAddress, profileCityId]);

  // Tant que le client n'a pas choisi une autre adresse, la récupération se fait à l'adresse du profil.
  useEffect(() => {
    if (profilePickup && !isCustomPickup) setSenderLocation(profilePickup);
  }, [profilePickup, isCustomPickup]);

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
    if (locationSelection.field === 'sender') {
      setSenderLocation(locationSelection.location);
      setIsCustomPickup(locationSelection.location.id !== profilePickup?.id);
    } else {
      setRecipientLocation(locationSelection.location);
    }
    consumeLocationSelection();
  }, [locationSelection, consumeLocationSelection, profilePickup]);

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

    if (senderName.length < 2) {
      setErrorMessage("Complétez votre profil (nom) avant d'envoyer un colis.");
      return;
    }
    if (recipientName.trim().length < 2) {
      setErrorMessage('Renseignez le nom du destinataire.');
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
        <LockedField label="Nom complet" value={senderName} placeholder="Nom non renseigné" />
        <LockedField label="Téléphone" value={senderPhone} placeholder="Téléphone non renseigné" />
        <LockedField
          label="Adresse du profil"
          value={profileAddress}
          secondary={profilePlace || null}
          placeholder="Adresse non renseignée"
        />
        <View style={styles.lockedNote}>
          <IconLock size={14} color={OCEAN.base} />
          <AppText variant="xs" color="textSecondary" style={styles.lockedNoteText}>
            Ces informations sont celles de votre profil : elles ne se modifient que dans{' '}
            <AppText
              variant="xs"
              weight="semibold"
              color={OCEAN.base}
              onPress={() => router.push('/(customer)/edit-profile')}
              accessibilityRole="link"
            >
              mon profil
            </AppText>
            .
          </AppText>
        </View>
        {!hasProfileAddress ? (
          <AppText variant="xs" color="danger">
            Ajoutez votre adresse et votre ville dans votre profil pour qu'elles soient proposées comme adresse de récupération.
          </AppText>
        ) : null}
        <AddressCard
          label="Adresse de récupération"
          tag={senderLocation && senderLocation.id === profilePickup?.id ? 'adresse du profil' : undefined}
          location={senderLocation}
          onPress={() => openAddressPicker('sender')}
        />
        {isCustomPickup && profilePickup ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setIsCustomPickup(false);
              setSenderLocation(profilePickup);
            }}
            style={({ pressed }) => [styles.resetPickup, pressed && styles.pressed]}
          >
            <IconCheck size={14} color={OCEAN.base} />
            <AppText variant="xs" weight="semibold" color={OCEAN.base}>
              Utiliser l'adresse de mon profil
            </AppText>
          </Pressable>
        ) : null}
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
  pressed: {
    opacity: 0.7,
  },
  lockedNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  lockedNoteText: {
    flex: 1,
  },
  resetPickup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
  },
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