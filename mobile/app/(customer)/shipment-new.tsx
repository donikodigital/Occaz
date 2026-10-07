// mobile/app/(customer)/shipment-new.tsx
// [07/10/2026] v6.1 — Les titres d'étape (Expéditeur, Destinataire, Colis, Période) passent en bandeau « hero » : voir
// FormAccordion.tsx. Seule modification ici : chaque étape reçoit `total` pour afficher « ÉTAPE n SUR 4 ».
// [04/10/2026] v6 — Formulaire en étapes repliables : une seule étape ouverte à la fois, les autres tiennent sur une ligne avec un
// résumé de ce qui est saisi (pastille numéro / coche / alerte). Les informations du profil et les détails facultatifs du colis
// sont repliés par défaut ; le code promo et le détail du prix aussi. Le prix à payer et « Confirmer l'envoi » restent fixes en
// bas de l'écran. Une erreur à la validation ouvre l'étape concernée. Tous les champs et règles sont conservés.
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
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconCalendarEvent,
  IconCheck,
  IconChevronRight,
  IconDiscount2,
  IconInfoCircle,
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
  OceanStepper,
  OceanSwitchRow,
} from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { ShipmentQuoteCard } from '@/components/screens/ShipmentQuoteCard';
import { ShipmentWindowField, toShipmentWindow } from '@/components/screens/ShipmentWindowField';
import { PromoCodeField } from '@/components/screens/PromoCodeField';
import { LockedField } from '@/components/screens/LockedField';
import { Disclosure, FormAccordionSection, StepProgress, animateNextLayout, type StepStatus } from '@/components/screens/FormAccordion';
import { useShipmentCategories } from '@/hooks/useShipmentCategories';
import { useCreateShipment, useShipmentQuote } from '@/hooks/useShipments';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useAuthStore } from '@/stores/authStore';
import { useLocationSelectionStore } from '@/stores/locationSelectionStore';
import { isValidPhoneNumber, normalizePhoneInput } from '@/utils/phone';
import { formatMoney } from '@/utils/money';
import { FLOW_DONE_PARAM } from '@/utils/navigation';
import { formatCityCountry, formatWindow } from '@/utils/shipmentDisplay';
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

type SectionKey = 'sender' | 'recipient' | 'parcel' | 'window';
const SECTION_ORDER: SectionKey[] = ['sender', 'recipient', 'parcel', 'window'];

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
  const [promoDiscount, setPromoDiscount] = useState<string | undefined>();
  // Étape ouverte (une seule à la fois) et dernière erreur de validation, rattachée à son étape quand elle en a une.
  const [openSection, setOpenSection] = useState<SectionKey | null>('sender');
  const [formError, setFormError] = useState<{ message: string; section?: SectionKey } | null>(null);
  const userToggled = useRef(false);

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
  const { data: quote, isFetching: isQuoteFetching, error: quoteError } = useShipmentQuote(debouncedQuotePayload);

  // --- État de chaque étape : complète, à faire ou à corriger -------------------------------------------------------------
  const weight = Number(weightKg.replace(',', '.'));
  const weightOk = Number.isFinite(weight) && weight > 0;
  const senderDone = senderName.length >= 2 && senderLocation !== null;
  const recipientDone = recipientName.trim().length >= 2 && isValidPhoneNumber(recipientPhone) && recipientLocation !== null;
  const parcelDone = categoryId !== null && weightOk;
  const windowDone = windowStart !== null && windowEnd !== null;
  const done: Record<SectionKey, boolean> = { sender: senderDone, recipient: recipientDone, parcel: parcelDone, window: windowDone };
  const doneCount = SECTION_ORDER.filter((key) => done[key]).length;
  const visibleError = formError && (!formError.section || !done[formError.section]) ? formError : null;
  const statusOf = (key: SectionKey): StepStatus =>
    done[key] ? 'done' : visibleError?.section === key ? 'error' : 'todo';

  // Dès que l'adresse de récupération est connue (adresse du profil chargée), on passe au destinataire — sauf si la personne
  // a déjà ouvert ou fermé une étape elle-même.
  useEffect(() => {
    if (!userToggled.current && senderDone && openSection === 'sender') {
      animateNextLayout();
      setOpenSection('recipient');
    }
  }, [senderDone, openSection]);

  function toggleSection(key: SectionKey) {
    userToggled.current = true;
    animateNextLayout();
    setOpenSection((current) => (current === key ? null : key));
  }

  function goToNextSection(from: SectionKey) {
    userToggled.current = true;
    animateNextLayout();
    const next = SECTION_ORDER[SECTION_ORDER.indexOf(from) + 1];
    setOpenSection(next ?? null);
  }

  /** Erreur de validation : ouvre l'étape concernée pour que la personne voie tout de suite quoi corriger. */
  function fail(section: SectionKey | undefined, message: string) {
    if (section) {
      userToggled.current = true;
      animateNextLayout();
      setOpenSection(section);
    }
    setFormError({ message, section });
  }

  // --- Résumés des étapes repliées ------------------------------------------------------------------------------------------
  const categoryName = (categories ?? []).find((category) => category.id === categoryId)?.name;
  const pickupPlace = senderLocation ? formatCityCountry(senderLocation) : null;
  const deliveryPlace = recipientLocation ? formatCityCountry(recipientLocation) : null;
  const summaries: Record<SectionKey, string> = {
    sender: senderLocation
      ? `${senderLocation.label}${pickupPlace ? ` · ${pickupPlace}` : ''}`
      : 'Adresse de récupération à choisir',
    recipient: [
      recipientName.trim() || null,
      recipientLocation ? (deliveryPlace ?? recipientLocation.label) : null,
      recipientDone ? null : !recipientLocation ? 'adresse à choisir' : !isValidPhoneNumber(recipientPhone) ? 'téléphone à compléter' : null,
    ]
      .filter(Boolean)
      .join(' · ') || 'À renseigner',
    parcel: parcelDone
      ? `${categoryName ?? 'Colis'} · ${weight} kg${quantity > 1 ? ` × ${quantity}` : ''}${isUrgent ? ' · Urgent' : ''}`
      : 'Catégorie et poids à indiquer',
    window: windowStart && windowEnd ? formatWindow(toShipmentWindow(windowStart, windowEnd)) : 'Dates à choisir',
  };

  const optionalDetails = [
    [lengthCm, widthCm, heightCm].every((value) => value.trim().length > 0) ? 'Dimensions' : null,
    declaredValue.trim() ? 'Valeur déclarée' : null,
    description.trim() ? 'Description' : null,
  ].filter(Boolean) as string[];

  // Ce qui manque pour afficher le prix — dit sous le « — » du pied de page.
  const missingForQuote = [
    !senderLocation ? 'adresse de récupération' : null,
    !recipientLocation ? 'adresse de livraison' : null,
    !categoryId ? 'catégorie' : null,
    !weightOk ? 'poids' : null,
  ].filter(Boolean) as string[];
  const isPriceComputing = quotePayload !== null && (quotePayload !== debouncedQuotePayload || !quote || isQuoteFetching);
  const discountNumber = promoDiscount ? Number(promoDiscount) : 0;
  const amountDue = quote ? Math.max(0, Number(quote.totalAmount) - discountNumber) : 0;

  function openAddressPicker(field: 'sender' | 'recipient') {
    openLocationPicker(field);
    router.push({
      pathname: '/(customer)/select-location',
      params: { title: field === 'sender' ? 'Adresse de récupération' : 'Adresse de livraison' },
    });
  }

  function handleSubmit() {
    setFormError(null);

    // Dans l'ordre des étapes : la première à corriger s'ouvre.
    if (senderName.length < 2) {
      fail('sender', "Complétez votre profil (nom) avant d'envoyer un colis.");
      return;
    }
    if (!senderLocation) {
      fail('sender', "Choisissez l'adresse de récupération.");
      return;
    }
    if (recipientName.trim().length < 2) {
      fail('recipient', 'Renseignez le nom du destinataire.');
      return;
    }
    if (!isValidPhoneNumber(recipientPhone)) {
      fail('recipient', 'Renseignez le téléphone du destinataire au format international, par exemple +224620000000.');
      return;
    }
    if (!recipientLocation) {
      fail('recipient', "Choisissez l'adresse de livraison.");
      return;
    }
    if (!categoryId) {
      fail('parcel', 'Choisissez une catégorie de colis.');
      return;
    }
    if (!weightOk) {
      fail('parcel', 'Indiquez le poids du colis.');
      return;
    }
    if (!windowStart || !windowEnd) {
      fail('window', 'Indiquez la période pendant laquelle le colis peut partir.');
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
        onSuccess: (shipment) =>
          router.replace({ pathname: '/(customer)/shipment/[id]', params: { id: shipment.id, ...FLOW_DONE_PARAM } }),
        onError: (error) => {
          setFormError({ message: error instanceof ApiError ? error.message : 'Une erreur est survenue.' });
        },
      },
    );
  }

  const footer = (
    <View style={styles.footer}>
      {visibleError ? (
        <View style={styles.footerError}>
          <IconAlertCircle size={15} color={colors.danger} />
          <AppText variant="xs" color="danger" style={styles.footerErrorText}>
            {visibleError.message}
          </AppText>
        </View>
      ) : null}
      <View style={styles.footerRow}>
        <View style={styles.footerPrice}>
          <AppText variant="xs" color="textSecondary">
            Prix à payer
          </AppText>
          {quotePayload === null ? (
            <>
              <AppText variant="lg" weight="bold" color="textMuted">
                —
              </AppText>
              <AppText variant="xs" color="textMuted" numberOfLines={2}>
                {missingForQuote.length > 0 ? `Il manque : ${missingForQuote.join(', ')}` : ''}
              </AppText>
            </>
          ) : quoteError ? (
            <AppText variant="sm" color="danger" numberOfLines={2}>
              Prix indisponible pour le moment
            </AppText>
          ) : isPriceComputing ? (
            <View style={styles.computing}>
              <ActivityIndicator size="small" color={colors.primary} />
              <AppText variant="xs" color="textSecondary">
                Calcul…
              </AppText>
            </View>
          ) : (
            <>
              <AppText variant="xl" weight="bold" color={OCEAN.deep} numberOfLines={1} adjustsFontSizeToFit>
                {formatMoney(String(amountDue), quote?.currencyCode ?? undefined)}
              </AppText>
              {discountNumber > 0 ? (
                <AppText variant="xs" color={colors.successDark}>
                  Code promo appliqué
                </AppText>
              ) : null}
            </>
          )}
        </View>
        <OceanButton
          label="Confirmer l'envoi"
          onPress={handleSubmit}
          loading={createShipment.isPending}
          style={styles.footerButton}
        />
      </View>
    </View>
  );

  return (
    <ScreenContainer scroll maxWidth="detail" footer={footer}>
      <OceanScreenHeader title="Envoyer un colis" subtitle="Complétez les étapes, une à la fois" onBack={() => router.back()} />

      <StepProgress done={doneCount} total={SECTION_ORDER.length} />

      {/* 1 — Expéditeur : l'adresse de récupération d'abord ; les informations du profil, repliées */}
      <FormAccordionSection
        step={1}
        total={SECTION_ORDER.length}
        icon={<IconUser size={15} color={OCEAN.base} />}
        title="Expéditeur"
        summary={summaries.sender}
        status={statusOf('sender')}
        expanded={openSection === 'sender'}
        onToggle={() => toggleSection('sender')}
      >
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

        <Disclosure
          icon={<IconLock size={15} color={OCEAN.base} />}
          label="Mes informations (profil)"
          preview={[senderName || 'Nom non renseigné', senderPhone || null].filter(Boolean).join(' · ')}
        >
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
        </Disclosure>

        <OceanButton label="Continuer" variant="soft" disabled={!senderDone} onPress={() => goToNextSection('sender')} />
      </FormAccordionSection>

      {/* 2 — Destinataire */}
      <FormAccordionSection
        step={2}
        total={SECTION_ORDER.length}
        icon={<IconUserCheck size={15} color={OCEAN.base} />}
        title="Destinataire"
        summary={summaries.recipient}
        status={statusOf('recipient')}
        expanded={openSection === 'recipient'}
        onToggle={() => toggleSection('recipient')}
      >
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
        <OceanButton label="Continuer" variant="soft" disabled={!recipientDone} onPress={() => goToNextSection('recipient')} />
      </FormAccordionSection>

      {/* 3 — Colis : l'essentiel d'abord ; dimensions, valeur et description, repliées */}
      <FormAccordionSection
        step={3}
        total={SECTION_ORDER.length}
        icon={<IconPackage size={15} color={OCEAN.base} />}
        title="Colis"
        summary={summaries.parcel}
        status={statusOf('parcel')}
        expanded={openSection === 'parcel'}
        onToggle={() => toggleSection('parcel')}
      >
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

        <OceanSwitchRow
          value={isUrgent}
          onChange={setIsUrgent}
          label="Envoi urgent"
          description="Une majoration peut s’appliquer au prix — voir le devis."
          icon={<IconAlertCircle size={18} color={OCEAN.base} />}
        />

        <Disclosure
          icon={<IconAdjustmentsHorizontal size={15} color={OCEAN.base} />}
          label="Plus de détails (optionnel)"
          preview={optionalDetails.length > 0 ? optionalDetails.join(' · ') : 'Dimensions, valeur déclarée, description'}
        >
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
        </Disclosure>

        <OceanButton label="Continuer" variant="soft" disabled={!parcelDone} onPress={() => goToNextSection('parcel')} />
      </FormAccordionSection>

      {/* 4 — Période */}
      <FormAccordionSection
        step={4}
        total={SECTION_ORDER.length}
        icon={<IconCalendarEvent size={15} color={OCEAN.base} />}
        title="Période"
        summary={summaries.window}
        status={statusOf('window')}
        expanded={openSection === 'window'}
        onToggle={() => toggleSection('window')}
      >
        <ShipmentWindowField
          startDate={windowStart}
          endDate={windowEnd}
          onChangeStart={setWindowStart}
          onChangeEnd={setWindowEnd}
        />
        <OceanButton label="Terminer" variant="soft" disabled={!windowDone} onPress={() => goToNextSection('window')} />
      </FormAccordionSection>

      {/* Facultatif : le code promo et le détail du prix restent à portée de main, repliés */}
      <View style={styles.extras}>
        <Disclosure
          icon={<IconDiscount2 size={15} color={OCEAN.base} />}
          label={promoCode ? `Code ${promoCode} appliqué` : "J'ai un code promo"}
          preview={promoDiscount ? `− ${formatMoney(promoDiscount, quote?.currencyCode ?? undefined)}` : null}
          keepMounted
        >
          <PromoCodeField
            serviceType="SHIPMENT"
            amount={quote?.totalAmount ?? null}
            currencyCode={quote?.currencyCode ?? undefined}
            appliedCode={promoCode}
            onChange={(code, discount) => {
              setPromoCode(code);
              setPromoDiscount(code ? discount : undefined);
            }}
          />
        </Disclosure>

        <Disclosure
          icon={<IconInfoCircle size={15} color={OCEAN.base} />}
          label="Détail du prix"
          preview="Distance, poids facturé, remboursement"
        >
          <ShipmentQuoteCard payload={quotePayload} discountAmount={promoDiscount} />
        </Disclosure>
      </View>
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
  extras: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },
  footer: {
    width: '100%',
    gap: spacing.sm,
  },
  footerError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  footerErrorText: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  footerPrice: {
    flex: 1,
    gap: 1,
  },
  footerButton: {
    flex: 1.2,
  },
  computing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 28,
  },
});