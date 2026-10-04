// mobile/app/(customer)/booking/new.tsx
//
// [04/10/2026] v3 — Écran refait dans le style bleu océan. Un bandeau en tête réunit l'essentiel du trajet (heure de montée,
// itinéraire avec ses adresses, conducteur, prix par place) ; le nombre de places et les passagers viennent ensuite ; le code
// promo et le détail du prix sont repliés. Le total à payer et « Confirmer » restent fixes en bas. Le montant s'affiche dans la
// devise du trajet (et non plus toujours en GNF) ; un trajet complet sur le tronçon n'est plus réservable.
//
// [03/10/2026] v+ — Tronçon réservé : le prix et le récapitulatif sont ceux du tronçon choisi (ex. Kindia → Labé).
// [23/09/2026] v+ — champ « Code promo », entre le nombre de places et le récapitulatif.
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconAlertCircle,
  IconCalendarEvent,
  IconDiscount2,
  IconInfoCircle,
  IconReceipt2,
  IconUserPlus,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { Disclosure } from '@/components/screens/FormAccordion';
import { PromoCodeField } from '@/components/screens/PromoCodeField';
import {
  OceanButton,
  OceanCard,
  OceanHeroCard,
  OceanScreenHeader,
  OceanSection,
  OceanStepper,
} from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useTrip } from '@/hooks/useTripSearch';
import { useCreateBooking } from '@/hooks/useBookings';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { formatDateLong, formatTime } from '@/utils/date';
import { formatMoney } from '@/utils/money';
import { ApiError } from '@/services/api/ApiError';
import { segmentAvailableSeats } from '@/utils/tripSegment';
import { FLOW_DONE_PARAM } from '@/utils/navigation';
import type { PassengerInput } from '@/types/bookings.types';

const HERO_MUTED = OCEAN.sky;
const HERO_SOFT = 'rgba(255,255,255,0.16)';

const capitalize = (value: string) => (value.length > 0 ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

export default function NewBookingScreen() {
  const { tripId, boardingStopId, alightingStopId } = useLocalSearchParams<{
    tripId: string;
    boardingStopId?: string;
    alightingStopId?: string;
  }>();
  const { data: trip, isLoading } = useTrip(tripId, { boardingStopId, alightingStopId });
  const { data: profile } = useCustomerProfile();
  const [seatsCount, setSeatsCount] = useState(1);
  const [extraPassengers, setExtraPassengers] = useState<PassengerInput[]>([]);
  const [promoCode, setPromoCode] = useState<string | undefined>();
  const [promoDiscount, setPromoDiscount] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createBooking = useCreateBooking();

  if (isLoading || !trip) {
    return (
      <ScreenContainer style={styles.center} maxWidth="detail">
        <ActivityIndicator color={colors.primary} />
      </ScreenContainer>
    );
  }

  // Places libres sur le tronçon du client : un siège pris jusqu'à Kindia est de nouveau libre après.
  const availableSeats = segmentAvailableSeats(trip);
  const isFull = availableSeats <= 0;
  const maxSeats = Math.max(1, Math.min(availableSeats, 8));
  // Le prix client (commission incluse) — jamais le prix brut du chauffeur, qui ne regarde ni le client ni cet écran.
  const customerPricePerSeat = Number(trip.customerPricePerSeat ?? trip.pricePerSeat);
  const totalAmount = customerPricePerSeat * seatsCount;
  const discountAmount = promoDiscount ? Number(promoDiscount) : 0;
  const amountDue = Math.max(0, totalAmount - discountAmount);
  const currencyCode = trip.currency?.isoCode ?? undefined;
  const money = (amount: number) => formatMoney(String(amount), currencyCode);

  // Itinéraire du client (son tronçon) et adresses de montée / descente.
  const segment = trip.segment;
  const fromCity = segment?.boardingCityName ?? trip.originCity.name;
  const toCity = segment?.alightingCityName ?? trip.destinationCity.name;
  const boardingStop = boardingStopId ? trip.stops?.find((stop) => stop.id === boardingStopId) : undefined;
  const alightingStop = alightingStopId ? trip.stops?.find((stop) => stop.id === alightingStopId) : undefined;
  const fromPlace = boardingStop ? boardingStop.location?.label : trip.originLocation?.label;
  const toPlace = alightingStop ? alightingStop.location?.label : trip.destinationLocation?.label;
  const boardingAt = segment?.boardingAt ?? trip.departureAt;
  const driverName = `${trip.driver.firstName} ${trip.driver.lastName[0] ?? ''}.`.trim();
  const clientName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : '';

  function changeSeats(next: number) {
    setSeatsCount(next);
    setExtraPassengers((current) => {
      const needed = next - 1;
      if (needed <= current.length) return current.slice(0, needed);
      return [...current, ...Array.from({ length: needed - current.length }, () => ({ fullName: '' }))];
    });
    // Le montant de base change avec le nombre de places — une réduction déjà validée contre l'ancien montant n'est plus
    // fiable, on la retire plutôt que d'afficher un total qui ne correspondrait plus à ce que le serveur calculera.
    if (promoCode) {
      setPromoCode(undefined);
      setPromoDiscount(undefined);
    }
  }

  function updatePassengerName(index: number, fullName: string) {
    setExtraPassengers((current) => current.map((p, i) => (i === index ? { ...p, fullName } : p)));
  }

  function handleConfirm() {
    if (!trip) return;
    setErrorMessage(undefined);

    if (isFull) {
      setErrorMessage('Ce trajet est complet sur votre tronçon.');
      return;
    }
    if (seatsCount > 1 && extraPassengers.some((p) => p.fullName.trim().length < 2)) {
      setErrorMessage('Renseignez le nom de chaque passager.');
      return;
    }

    const passengers: PassengerInput[] | undefined =
      seatsCount === 1 ? undefined : [{ fullName: clientName }, ...extraPassengers];

    createBooking.mutate(
      { tripId: trip.id, seatsCount, passengers, promoCode, boardingStopId, alightingStopId },
      {
        onSuccess: (booking) =>
          router.replace({ pathname: '/(customer)/booking/[id]', params: { id: booking.id, ...FLOW_DONE_PARAM } }),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
        },
      },
    );
  }

  const footer = (
    <View style={styles.footer}>
      {errorMessage ? (
        <View style={styles.footerError}>
          <IconAlertCircle size={15} color={colors.danger} />
          <AppText variant="xs" color="danger" style={styles.footerErrorText}>
            {errorMessage}
          </AppText>
        </View>
      ) : null}
      <View style={styles.footerRow}>
        <View style={styles.footerPrice}>
          <AppText variant="xs" color="textSecondary">
            Total à payer
          </AppText>
          <AppText variant="xl" weight="bold" color={OCEAN.deep} numberOfLines={1} adjustsFontSizeToFit>
            {money(amountDue)}
          </AppText>
          <AppText variant="xs" color={discountAmount > 0 ? colors.successDark : 'textMuted'} numberOfLines={1}>
            {discountAmount > 0
              ? 'Code promo appliqué'
              : `${seatsCount} place${seatsCount > 1 ? 's' : ''} · ${fromCity} → ${toCity}`}
          </AppText>
        </View>
        <OceanButton
          label="Confirmer"
          onPress={handleConfirm}
          loading={createBooking.isPending}
          disabled={isFull}
          style={styles.footerButton}
        />
      </View>
    </View>
  );

  return (
    <ScreenContainer scroll maxWidth="detail" footer={footer}>
      <OceanScreenHeader title="Réserver" subtitle="Vérifiez, puis confirmez" onBack={() => router.back()} />

      {/* Bandeau : quand, où, avec qui, à quel prix */}
      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroWhen}>
          <View style={styles.dateChip}>
            <IconCalendarEvent size={13} color={colors.onPrimary} />
            <AppText variant="xs" weight="semibold" color={colors.onPrimary}>
              {capitalize(formatDateLong(boardingAt))}
            </AppText>
          </View>
          <AppText variant="xxl" weight="bold" color={colors.onPrimary}>
            {formatTime(boardingAt)}
          </AppText>
          <AppText variant="xs" color={HERO_MUTED}>
            {segment?.boardingStopId ? `Passage estimé à ${fromCity}` : `Départ de ${fromCity}`}
          </AppText>
        </View>

        <View style={styles.route}>
          <View style={styles.rail}>
            <View style={styles.railDotFrom} />
            <View style={styles.railLine} />
            <View style={styles.railDotTo} />
          </View>
          <View style={styles.routeCities}>
            <View>
              <AppText variant="xl" weight="bold" color={colors.onPrimary} numberOfLines={1}>
                {fromCity}
              </AppText>
              {fromPlace ? (
                <AppText variant="xs" color={HERO_MUTED} numberOfLines={1}>
                  {fromPlace}
                </AppText>
              ) : null}
            </View>
            <View>
              <AppText variant="xl" weight="bold" color={colors.onPrimary} numberOfLines={1}>
                {toCity}
              </AppText>
              {toPlace ? (
                <AppText variant="xs" color={HERO_MUTED} numberOfLines={1}>
                  {toPlace}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.heroBottom}>
          <View style={styles.driverChip}>
            <View style={styles.driverAvatar}>
              <AppText variant="xs" weight="bold" color={OCEAN.deep}>
                {initialsOf(`${trip.driver.firstName} ${trip.driver.lastName}`)}
              </AppText>
            </View>
            <View>
              <AppText variant="xs" color={HERO_MUTED}>
                Conducteur
              </AppText>
              <AppText variant="sm" weight="semibold" color={colors.onPrimary}>
                {driverName}
              </AppText>
            </View>
          </View>
          <View style={styles.priceBlock}>
            <AppText variant="xs" color={HERO_MUTED}>
              Par place
            </AppText>
            <AppText variant="md" weight="bold" color={colors.onPrimary}>
              {money(customerPricePerSeat)}
            </AppText>
          </View>
        </View>
      </OceanHeroCard>

      {isFull ? (
        <View style={styles.fullNotice}>
          <IconAlertCircle size={16} color={colors.danger} />
          <AppText variant="sm" color="danger" style={styles.fullNoticeText}>
            Ce trajet est complet sur votre tronçon. Cherchez un autre trajet ou une autre date.
          </AppText>
        </View>
      ) : null}

      {/* Places */}
      <OceanSection icon={<IconUsers size={17} color={OCEAN.base} />} title="Places">
        <View style={styles.seatsRow}>
          <View style={styles.seatsText}>
            <AppText variant="base" weight="semibold">
              Nombre de places
            </AppText>
            <AppText variant="xs" color="textSecondary">
              {isFull
                ? 'Aucune place disponible'
                : `${availableSeats} disponible${availableSeats > 1 ? 's' : ''} sur votre tronçon`}
            </AppText>
          </View>
          <OceanStepper value={seatsCount} onChange={changeSeats} min={1} max={maxSeats} label="places" />
        </View>
      </OceanSection>

      {/* Passagers : seulement quand on réserve pour plusieurs personnes */}
      {extraPassengers.length > 0 ? (
        <OceanSection icon={<IconUserPlus size={17} color={OCEAN.base} />} title="Passagers">
          <OceanCard style={styles.youCard}>
            <View style={styles.youAvatar}>
              <AppText variant="xs" weight="bold" color={OCEAN.base}>
                {initialsOf(clientName) || '·'}
              </AppText>
            </View>
            <View style={styles.youText}>
              <AppText variant="sm" weight="semibold" numberOfLines={1}>
                {clientName || 'Vous'}
              </AppText>
              <AppText variant="xs" color="textSecondary">
                Passager 1 · vous
              </AppText>
            </View>
          </OceanCard>
          {extraPassengers.map((passenger, index) => (
            <TextField
              key={index}
              label={`Passager ${index + 2}`}
              value={passenger.fullName}
              onChangeText={(text) => updatePassengerName(index, text)}
              placeholder="Nom complet"
            />
          ))}
        </OceanSection>
      ) : null}

      {/* Repliés : le code promo et le détail du prix */}
      <View style={styles.extras}>
        <Disclosure
          icon={<IconDiscount2 size={15} color={OCEAN.base} />}
          label={promoCode ? `Code ${promoCode} appliqué` : "J'ai un code promo"}
          preview={discountAmount > 0 ? `− ${money(discountAmount)}` : null}
          keepMounted
        >
          <PromoCodeField
            serviceType="TRIP"
            amount={String(totalAmount)}
            appliedCode={promoCode}
            onChange={(code, discount) => {
              setPromoCode(code);
              setPromoDiscount(discount);
            }}
          />
        </Disclosure>

        <Disclosure
          icon={<IconReceipt2 size={15} color={OCEAN.base} />}
          label="Détail du prix"
          preview={`${money(customerPricePerSeat)} × ${seatsCount} place${seatsCount > 1 ? 's' : ''}`}
        >
          <View style={styles.breakdown}>
            <View style={styles.breakdownRow}>
              <AppText variant="sm" color="textSecondary">
                {money(customerPricePerSeat)} × {seatsCount} place{seatsCount > 1 ? 's' : ''}
              </AppText>
              <AppText variant="sm" weight="semibold">
                {money(totalAmount)}
              </AppText>
            </View>
            {discountAmount > 0 ? (
              <View style={styles.breakdownRow}>
                <AppText variant="sm" color={colors.successDark}>
                  Code promo {promoCode}
                </AppText>
                <AppText variant="sm" weight="semibold" color={colors.successDark}>
                  − {money(discountAmount)}
                </AppText>
              </View>
            ) : null}
            <View style={styles.breakdownDivider} />
            <View style={styles.breakdownRow}>
              <AppText variant="base" weight="bold">
                Total à payer
              </AppText>
              <AppText variant="base" weight="bold">
                {money(amountDue)}
              </AppText>
            </View>
            <AppText variant="xs" color="textMuted">
              Frais de service inclus dans le prix par place.
            </AppText>
          </View>
        </Disclosure>
      </View>

      <View style={styles.note}>
        <IconInfoCircle size={15} color={OCEAN.base} />
        <AppText variant="xs" color="textSecondary" style={styles.noteText}>
          Le paiement se fait à l'étape suivante. Une réservation non payée expire automatiquement.
        </AppText>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Bandeau
  hero: {
    padding: spacing.lg,
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  heroWhen: {
    gap: 4,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: HERO_SOFT,
  },
  route: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rail: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  railDotFrom: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.onPrimary,
  },
  railLine: {
    flex: 1,
    width: 2,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  railDotTo: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: OCEAN.gold,
    backgroundColor: 'transparent',
  },
  routeCities: {
    flex: 1,
    gap: spacing.lg,
  },
  heroBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  driverChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.sky,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },

  // Trajet complet
  fullNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: radius.md,
    backgroundColor: '#FDECEC',
  },
  fullNoticeText: {
    flex: 1,
  },

  // Places et passagers
  seatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  seatsText: {
    flex: 1,
    gap: 2,
  },
  youCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
  },
  youAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OCEAN.mist,
  },
  youText: {
    flex: 1,
  },

  // Repliés
  extras: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  breakdown: {
    gap: spacing.sm,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  breakdownDivider: {
    height: 1,
    backgroundColor: OCEAN.line,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xs,
  },
  noteText: {
    flex: 1,
  },

  // Pied de page fixe
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
    flex: 1,
  },
});
