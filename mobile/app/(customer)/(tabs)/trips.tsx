// mobile/app/(customer)/(tabs)/trips.tsx
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
import { IconAlertTriangle, IconChevronRight, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanPill, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyShipments } from '@/hooks/useShipments';
import { formatMoney } from '@/utils/money';
import { formatDateShort, formatTime } from '@/utils/date';
import type { Booking, BookingStatus } from '@/types/bookings.types';
import type { Shipment, ShipmentStatus } from '@/types/shipments.types';

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
  PENDING_PAYMENT: 'À payer',
  PAID: 'Payée',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
  REFUNDED: 'Remboursée',
  DISPUTED: 'En litige',
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
  CREATED: 'À payer',
  SEARCHING_DRIVER: 'Recherche',
  DRIVER_ASSIGNED: 'Assigné',
  PICKUP_PENDING: 'Récupération',
  PICKED_UP: 'Récupéré',
  IN_TRANSIT: 'En transit',
  DELIVERY_PENDING: 'Livraison',
  DELIVERED: 'Livré',
  COMPLETED: 'Terminé',
  CANCELLED: 'Annulé',
  DISPUTED: 'En litige',
  REFUNDED: 'Remboursé',
};

function BookingRow({ booking }: { booking: Booking }) {
  const trip = booking.trip;
  return (
    <OceanCard onPress={() => router.push(`/(customer)/booking/${booking.id}`)} style={styles.row} accessibilityLabel="Ouvrir la réservation">
      <View style={styles.rowIcon}>
        <IconRoute size={19} color={OCEAN.base} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {trip ? `${trip.originCity.name} → ${trip.destinationCity.name}` : 'Trajet'}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {trip ? `${formatDateShort(trip.departureAt)} · ${formatTime(trip.departureAt)}` : ''}
        </AppText>
      </View>
      <View style={styles.rowEnd}>
        <AppText variant="sm" weight="bold" color={OCEAN.deep}>
          {formatMoney(booking.totalAmount)}
        </AppText>
        <OceanPill label={BOOKING_STATUS_LABELS[booking.status]} tone={TONE_TO_PILL[BOOKING_STATUS_TONE[booking.status]]} />
      </View>
    </OceanCard>
  );
}

function ShipmentRow({ shipment }: { shipment: Shipment }) {
  return (
    <OceanCard onPress={() => router.push(`/(customer)/shipment/${shipment.id}`)} style={styles.row} accessibilityLabel="Ouvrir l'envoi">
      <View style={[styles.rowIcon, styles.rowIconShipment]}>
        <IconPackage size={19} color={OCEAN.goldInk} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {shipment.recipientName}
        </AppText>
        <AppText variant="xs" color="textSecondary" numberOfLines={1}>
          {shipment.recipientLocation?.label ?? formatDateShort(shipment.createdAt)}
        </AppText>
      </View>
      <View style={styles.rowEnd}>
        <AppText variant="sm" weight="bold" color={OCEAN.deep}>
          {formatMoney(shipment.totalAmount)}
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
  const [segment, setSegment] = useState<Segment>('trips');
  const bookingsQuery = useMyBookings();
  const shipmentsQuery = useMyShipments();

  const bookings = bookingsQuery.data?.data ?? [];
  const shipments = shipmentsQuery.data?.data ?? [];
  const isLoading = segment === 'trips' ? bookingsQuery.isLoading : shipmentsQuery.isLoading;

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
      <View style={styles.titleBlock}>
        <AppText variant="xxl" weight="bold" color={OCEAN.deep}>
          Mon activité
        </AppText>
        <AppText variant="sm" color="textSecondary">
          Vos réservations et vos envois, au même endroit.
        </AppText>
      </View>

      <Segmented
        value={segment}
        onChange={setSegment}
        items={[
          { id: 'trips', label: 'Trajets', count: bookingsQuery.data ? bookings.length : undefined },
          { id: 'shipments', label: 'Envois', count: shipmentsQuery.data ? shipments.length : undefined },
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
              {pendingCount} {segment === 'trips' ? (pendingCount > 1 ? 'réservations' : 'réservation') : pendingCount > 1 ? 'envois' : 'envoi'} à payer
            </AppText>
            <AppText variant="xs" color={OCEAN.goldInk}>
              Ouvrez-{pendingCount > 1 ? 'en une' : 'la'} pour finaliser le paiement.
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
      title="Aucune réservation"
      text="Vos réservations de trajets apparaîtront ici."
      action={<OceanButton label="Trouver un trajet" onPress={() => router.push('/(customer)/trip-search')} style={styles.emptyButton} />}
    />
  );

  const emptyShipments = (
    <OceanEmpty
      icon={<IconPackage size={28} color={OCEAN.base} />}
      title="Aucun envoi"
      text="Les colis que vous envoyez apparaîtront ici, avec leur suivi."
      action={<OceanButton label="Envoyer un colis" onPress={() => router.push('/(customer)/shipment-new')} style={styles.emptyButton} />}
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
          ListEmptyComponent={!isLoading ? emptyTrips : undefined}
          renderItem={({ item }) => <BookingRow booking={item} />}
        />
      ) : (
        <ResponsiveList
          data={shipments}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={header}
          ListEmptyComponent={!isLoading ? emptyShipments : undefined}
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
  titleBlock: {
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
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