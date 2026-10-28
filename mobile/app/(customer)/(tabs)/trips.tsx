// mobile/app/(customer)/(tabs)/trips.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [25/10/2026] v4 — chargement de la suite en bas de liste, compteurs réels (total du serveur), tirer pour actualiser, état d'échec avec « Réessayer ».
// [20/10/2026] v3b — la carte d'un envoi affiche sa date d'envoi (« Envoyé le 17 oct. 2026 »).
// [07/10/2026] v3 — « Mon activité » et sa phrase passent dans un bandeau (hero) bleu océan ; le reste de l'écran est inchangé.
// [21/09/2026] v+ — le montant d'un envoi s'affiche dans sa devise.
// [03/10/2026] v+ — la carte d'un envoi montre « ville de départ → ville d'arrivée » : on comprend d'un coup d'œil pourquoi
// deux envois sont dans deux devises (la devise est celle du pays de ramassage).
//
// v2 — « Mon activité » en bleu océan, dans le style de l'accueil et du
// profil. Un titre, deux segments (Trajets / Envois) avec leur compteur, un
// bandeau doré quand quelque chose attend un paiement (il ouvre directement
// l'élément à payer), et une carte par réservation ou envoi : itinéraire ou
// destinataire, date, montant et statut. Sans donnée : un état vide qui
// propose l'action logique (trouver un trajet, envoyer un colis).

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconActivity, IconAlertTriangle, IconChevronRight, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanHeroCard, OceanPill, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyBookingsList } from '@/hooks/useBookings';
import { useMyShipmentsList } from '@/hooks/useShipments';
import { ListFailed, ListLoading, ListMoreFooter, listRefreshControl } from '@/components/ocean/ListFeedback';
import { currencyOf, formatMoney } from '@/utils/money';
import { formatDateShort, formatDateWithYear, formatTime } from '@/utils/date';
import { formatCityCountry, formatShipmentRoute } from '@/utils/shipmentDisplay';
import { bookingBoardingAt, bookingRouteLabel } from '@/utils/tripSegment';
import type { Booking, BookingStatus } from '@/types/bookings.types';
import type { Shipment, ShipmentStatus } from '@/types/shipments.types';
import { useT, translate } from '@/i18n';

type Segment = 'trips' | 'shipments';
type StatusTone = 'primary' | 'success' | 'danger' | 'neutral';

const TONE_TO_PILL: Record<StatusTone, OceanPillTone> = {
  primary: 'ocean',
  success: 'success',
  danger: 'danger',
  neutral: 'neutral',
};

const BOOKING_STATUS_TONE: Record<BookingStatus, StatusTone> = {
  PENDING_PAYMENT: 'neutral',
  PAID: 'primary',
  CONFIRMED: 'success',
  CANCELLED: 'danger',
  COMPLETED: 'success',
  REFUNDED: 'neutral',
  DISPUTED: 'danger',
};

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  get PENDING_PAYMENT() { return translate('À payer'); },
  get PAID() { return translate('Payée'); },
  get CONFIRMED() { return translate('Confirmée'); },
  get CANCELLED() { return translate('Annulée'); },
  get COMPLETED() { return translate('Terminée'); },
  get REFUNDED() { return translate('Remboursée'); },
  get DISPUTED() { return translate('En litige'); },
};

const SHIPMENT_STATUS_TONE: Record<ShipmentStatus, StatusTone> = {
  CREATED: 'neutral',
  SEARCHING_DRIVER: 'primary',
  DRIVER_ASSIGNED: 'primary',
  PICKUP_PENDING: 'primary',
  PICKED_UP: 'primary',
  IN_TRANSIT: 'primary',
  DELIVERY_PENDING: 'primary',
  DELIVERED: 'success',
  COMPLETED: 'success',
  CANCELLED: 'danger',
  DISPUTED: 'danger',
  REFUNDED: 'neutral',
};

const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  get CREATED() { return translate('À payer'); },
  get SEARCHING_DRIVER() { return translate('Recherche'); },
  get DRIVER_ASSIGNED() { return translate('Assigné'); },
  get PICKUP_PENDING() { return translate('Récupération'); },
  get PICKED_UP() { return translate('Récupéré'); },
  get IN_TRANSIT() { return translate('En transit'); },
  get DELIVERY_PENDING() { return translate('Livraison'); },
  get DELIVERED() { return translate('Livré'); },
  get COMPLETED() { return translate('Terminé'); },
  get CANCELLED() { return translate('Annulé'); },
  get DISPUTED() { return translate('En litige'); },
  get REFUNDED() { return translate('Remboursé'); },
};

function BookingRow({ booking }: { booking: Booking }) {
  const t = useT();
  const trip = booking.trip;
  return (
    <OceanCard onPress={() => router.push(`/(customer)/booking/${booking.id}`)} style={styles.row} accessibilityLabel={t('Ouvrir la réservation')}>
      <View style={styles.rowIcon}>
        <IconRoute size={19} color={OCEAN.base} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {bookingRouteLabel(booking) ?? t('Trajet')}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {trip ? `${formatDateShort(bookingBoardingAt(booking) ?? trip.departureAt)} · ${formatTime(bookingBoardingAt(booking) ?? trip.departureAt)}` : ''}
        </AppText>
      </View>
      <View style={styles.rowEnd}>
        <AppText variant="sm" weight="bold" color={OCEAN.deep}>
          {formatMoney(booking.totalAmount, currencyOf(booking))}
        </AppText>
        <OceanPill label={BOOKING_STATUS_LABELS[booking.status]} tone={TONE_TO_PILL[BOOKING_STATUS_TONE[booking.status]]} />
      </View>
    </OceanCard>
  );
}

function ShipmentRow({ shipment }: { shipment: Shipment }) {
  const t = useT();
  return (
    <OceanCard onPress={() => router.push(`/(customer)/shipment/${shipment.id}`)} style={styles.row} accessibilityLabel={t("Ouvrir l'envoi")}>
      <View style={[styles.rowIcon, styles.rowIconShipment]}>
        <IconPackage size={19} color={OCEAN.goldInk} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {shipment.recipientName}
        </AppText>
        <AppText variant="xs" color="textSecondary" numberOfLines={1}>
          {formatShipmentRoute(shipment) ??
            formatCityCountry(shipment.recipientLocation) ??
            shipment.recipientLocation?.label ??
            t('Colis')}
        </AppText>
        <AppText variant="xs" color="textMuted" numberOfLines={1}>
          {t('Envoyé le {dateWithYear}', { dateWithYear: formatDateWithYear(shipment.createdAt) })}
        </AppText>
      </View>
      <View style={styles.rowEnd}>
        <AppText variant="sm" weight="bold" color={OCEAN.deep}>
          {formatMoney(shipment.totalAmount, shipment.currency?.isoCode)}
        </AppText>
        <OceanPill label={SHIPMENT_STATUS_LABELS[shipment.status]} tone={TONE_TO_PILL[SHIPMENT_STATUS_TONE[shipment.status]]} />
      </View>
    </OceanCard>
  );
}

function Segmented({
  value,
  onChange,
  items,
}: {
  value: Segment;
  onChange: (segment: Segment) => void;
  items: { id: Segment; label: string; count: number | undefined }[];
}) {
  return (
    <View style={styles.segmented}>
      {items.map((item) => {
        const isActive = item.id === value;
        return (
          <Pressable
            key={item.id}
            onPress={() => onChange(item.id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            style={[styles.segment, isActive && styles.segmentActive]}
          >
            <AppText variant="sm" weight="bold" color={isActive ? OCEAN.onDark : OCEAN.base}>
              {item.label}
            </AppText>
            {item.count !== undefined ? (
              <View style={[styles.segmentCount, isActive && styles.segmentCountActive]}>
                <AppText variant="xs" weight="bold" color={isActive ? OCEAN.onDark : OCEAN.base}>
                  {item.count}
                </AppText>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ActivityScreen() {
  const t = useT();
  const [segment, setSegment] = useState<Segment>('trips');
  const bookingsQuery = useMyBookingsList();
  const shipmentsQuery = useMyShipmentsList();

  const bookings = bookingsQuery.items;
  const shipments = shipmentsQuery.items;
  const current = segment === 'trips' ? bookingsQuery : shipmentsQuery;
  const isLoading = current.isLoading;

  // Ce qui attend un paiement dans le segment affiché : le bandeau ouvre directement l'élément concerné.
  const pendingBookings = bookings.filter((booking) => booking.status === 'PENDING_PAYMENT');
  const pendingShipments = shipments.filter((shipment) => shipment.status === 'CREATED');
  const pendingCount = segment === 'trips' ? pendingBookings.length : pendingShipments.length;

  function openFirstPending() {
    if (segment === 'trips' && pendingBookings[0]) router.push(`/(customer)/booking/${pendingBookings[0].id}`);
    if (segment === 'shipments' && pendingShipments[0]) router.push(`/(customer)/shipment/${pendingShipments[0].id}`);
  }

  const header = (
    <View>
      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <IconActivity size={28} color={OCEAN.onDark} />
        </View>
        <View style={styles.heroTitles}>
          <AppText variant="xl" weight="bold" color={OCEAN.onDark}>
            {t('Mon activité')}
          </AppText>
          <AppText variant="xs" color={OCEAN.sky}>
            {t('Vos réservations et vos envois, au même endroit.')}
          </AppText>
        </View>
      </OceanHeroCard>

      <Segmented
        value={segment}
        onChange={setSegment}
        items={[
          { id: 'trips', label: t('Trajets'), count: bookingsQuery.total },
          { id: 'shipments', label: t('Envois'), count: shipmentsQuery.total },
        ]}
      />

      {pendingCount > 0 ? (
        <Pressable
          onPress={openFirstPending}
          accessibilityRole="button"
          style={({ pressed }) => [styles.banner, pressed && styles.pressed]}
        >
          <IconAlertTriangle size={18} color={OCEAN.goldInk} />
          <View style={styles.bannerText}>
            <AppText variant="sm" weight="semibold" color={OCEAN.goldInk}>
              {segment === 'trips' ? t.n(pendingCount, '{count} réservation à payer', '{count} réservations à payer') : t.n(pendingCount, '{count} envoi à payer', '{count} envois à payer')}
            </AppText>
            <AppText variant="xs" color={OCEAN.goldInk}>
              {pendingCount > 1 ? t('Ouvrez-en une pour finaliser le paiement.') : t('Ouvrez-la pour finaliser le paiement.')}
            </AppText>
          </View>
          <IconChevronRight size={16} color={OCEAN.goldInk} />
        </Pressable>
      ) : null}
    </View>
  );

  const emptyTrips = (
    <OceanEmpty
      icon={<IconRoute size={28} color={OCEAN.base} />}
      title={t('Aucune réservation')}
      text={t('Vos réservations de trajets apparaîtront ici.')}
      action={<OceanButton label={t('Trouver un trajet')} onPress={() => router.push('/(customer)/trip-search')} style={styles.emptyButton} />}
    />
  );

  const emptyShipments = (
    <OceanEmpty
      icon={<IconPackage size={28} color={OCEAN.base} />}
      title={t('Aucun envoi')}
      text={t('Les colis que vous envoyez apparaîtront ici, avec leur suivi.')}
      action={<OceanButton label={t('Envoyer un colis')} onPress={() => router.push('/(customer)/shipment-new')} style={styles.emptyButton} />}
    />
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      {segment === 'trips' ? (
        <ResponsiveList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={header}
          ListEmptyComponent={isLoading ? <ListLoading /> : bookingsQuery.hasFailed ? <ListFailed onRetry={bookingsQuery.refresh} /> : emptyTrips}
          ListFooterComponent={<ListMoreFooter loading={bookingsQuery.isLoadingMore} />}
          refreshControl={listRefreshControl(bookingsQuery.isRefreshing, bookingsQuery.refresh)}
          onEndReached={bookingsQuery.loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => <BookingRow booking={item} />}
        />
      ) : (
        <ResponsiveList
          data={shipments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={header}
          ListEmptyComponent={isLoading ? <ListLoading /> : shipmentsQuery.hasFailed ? <ListFailed onRetry={shipmentsQuery.refresh} /> : emptyShipments}
          ListFooterComponent={<ListMoreFooter loading={shipmentsQuery.isLoadingMore} />}
          refreshControl={listRefreshControl(shipmentsQuery.isRefreshing, shipmentsQuery.refresh)}
          onEndReached={shipmentsQuery.loadMore}
          onEndReachedThreshold={0.4}
          renderItem={({ item }) => <ShipmentRow shipment={item} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  heroBadge: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  heroTitles: {
    flex: 1,
    gap: 2,
  },
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: radius.pill,
    backgroundColor: OCEAN.mist,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: OCEAN.base,
  },
  segmentCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentCountActive: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: OCEAN.goldSoft,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 4,
  },
  rowIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconShipment: {
    backgroundColor: OCEAN.goldSoft,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowEnd: {
    alignItems: 'flex-end',
    gap: 5,
  },
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});