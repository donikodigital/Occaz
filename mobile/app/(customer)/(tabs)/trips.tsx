// mobile/app/(customer)/(tabs)/trips.tsx
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, Badge, Card, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyShipments } from '@/hooks/useShipments';
import { formatMoney } from '@/utils/money';
import { formatDateShort, formatTime } from '@/utils/date';
import type { Booking, BookingStatus } from '@/types/bookings.types';
import type { Shipment, ShipmentStatus } from '@/types/shipments.types';

type Segment = 'trips' | 'shipments';

const BOOKING_STATUS_TONE: Record<BookingStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
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

const SHIPMENT_STATUS_TONE: Record<ShipmentStatus, 'primary' | 'success' | 'danger' | 'neutral'> = {
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
    <Card onPress={() => router.push(`/(customer)/booking/${booking.id}`)} style={styles.row}>
      <View style={styles.rowIcon}>
        <IconRoute size={18} color={colors.primary} />
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
        <AppText variant="sm" weight="semibold">
          {formatMoney(booking.totalAmount, '')}
        </AppText>
        <Badge label={BOOKING_STATUS_LABELS[booking.status]} tone={BOOKING_STATUS_TONE[booking.status]} />
      </View>
    </Card>
  );
}

function ShipmentRow({ shipment }: { shipment: Shipment }) {
  return (
    <Card onPress={() => router.push(`/(customer)/shipment/${shipment.id}`)} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: colors.accentLight }]}>
        <IconPackage size={18} color={colors.accentDark} />
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
        <AppText variant="sm" weight="semibold">
          {formatMoney(shipment.totalAmount, '')}
        </AppText>
        <Badge label={SHIPMENT_STATUS_LABELS[shipment.status]} tone={SHIPMENT_STATUS_TONE[shipment.status]} />
      </View>
    </Card>
  );
}

export default function ActivityScreen() {
  const [segment, setSegment] = useState<Segment>('trips');
  const bookingsQuery = useMyBookings();
  const shipmentsQuery = useMyShipments();

  const isLoading = segment === 'trips' ? bookingsQuery.isLoading : shipmentsQuery.isLoading;

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <AppText variant="xxl" weight="semibold" style={styles.title}>
        Mon activité
      </AppText>

      <View style={styles.segmentRow}>
        <Pressable
          onPress={() => setSegment('trips')}
          style={[styles.segment, segment === 'trips' && styles.segmentActive]}
        >
          <AppText variant="sm" weight="semibold" color={segment === 'trips' ? colors.onPrimary : 'textPrimary'}>
            Trajets
          </AppText>
        </Pressable>
        <Pressable
          onPress={() => setSegment('shipments')}
          style={[styles.segment, segment === 'shipments' && styles.segmentActive]}
        >
          <AppText
            variant="sm"
            weight="semibold"
            color={segment === 'shipments' ? colors.onPrimary : 'textPrimary'}
          >
            Envois
          </AppText>
        </Pressable>
      </View>

      {segment === 'trips' ? (
        <ResponsiveList
          data={bookingsQuery.data?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !isLoading
              ? () => (
                  <AppText variant="sm" color="textMuted" style={styles.empty}>
                    Aucune réservation pour le moment.
                  </AppText>
                )
              : undefined
          }
          renderItem={({ item }) => <BookingRow booking={item} />}
        />
      ) : (
        <ResponsiveList
          data={shipmentsQuery.data?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !isLoading
              ? () => (
                  <AppText variant="sm" color="textMuted" style={styles.empty}>
                    Aucun envoi pour le moment.
                  </AppText>
                )
              : undefined
          }
          renderItem={({ item }) => <ShipmentRow shipment={item} />}
        />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.md,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  rowEnd: {
    alignItems: 'flex-end',
    gap: 4,
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
