// mobile/app/(driver)/(tabs)/trips.tsx
// [21/09/2026] v+ — la ligne d'un envoi affiche le gain net du chauffeur (et non le prix payé par le client) dans la bonne devise, avec la période.
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, Badge, Card, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useAssignedShipments } from '@/hooks/useDriverShipments';
import { formatDateShort, formatTime } from '@/utils/date';
import {
  SHIPMENT_STATUS_LABELS,
  SHIPMENT_STATUS_TONE,
  TRIP_STATUS_LABELS,
  TRIP_STATUS_TONE,
} from '@/utils/tripStatusLabels';
import { formatMoney } from '@/utils/money';
import { driverNetAmount, formatWindow } from '@/utils/shipmentDisplay';
import type { Trip } from '@/types/trips.types';
import type { Shipment } from '@/types/shipments.types';

type Segment = 'trips' | 'shipments';

function TripRow({ trip }: { trip: Trip }) {
  return (
    <Card onPress={() => router.push(`/(driver)/trip/${trip.id}`)} style={styles.row}>
      <View style={styles.rowIcon}>
        <IconRoute size={18} color={colors.success} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {trip.originCity.name} → {trip.destinationCity.name}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(trip.departureAt)} · {formatTime(trip.departureAt)}
        </AppText>
      </View>
      <Badge label={TRIP_STATUS_LABELS[trip.status]} tone={TRIP_STATUS_TONE[trip.status]} />
    </Card>
  );
}

function ShipmentRow({ shipment }: { shipment: Shipment }) {
  return (
    <Card onPress={() => router.push(`/(driver)/shipment/${shipment.id}`)} style={styles.row}>
      <View style={[styles.rowIcon, { backgroundColor: colors.accentLight }]}>
        <IconPackage size={18} color={colors.accentDark} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {shipment.recipientName}
        </AppText>
        <AppText variant="xs" color="textSecondary" numberOfLines={1}>
          Vous recevrez {formatMoney(driverNetAmount(shipment), shipment.currency?.isoCode)} · {formatWindow(shipment)}
        </AppText>
      </View>
      <Badge label={SHIPMENT_STATUS_LABELS[shipment.status]} tone={SHIPMENT_STATUS_TONE[shipment.status]} />
    </Card>
  );
}

export default function DriverActivityScreen() {
  const [segment, setSegment] = useState<Segment>('trips');
  const tripsQuery = useMyTrips();
  const shipmentsQuery = useAssignedShipments();

  const isLoading = segment === 'trips' ? tripsQuery.isLoading : shipmentsQuery.isLoading;

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
          data={tripsQuery.data?.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !isLoading
              ? () => (
                  <AppText variant="sm" color="textMuted" style={styles.empty}>
                    Aucun trajet créé pour le moment.
                  </AppText>
                )
              : undefined
          }
          renderItem={({ item }) => <TripRow trip={item} />}
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
                    Aucun envoi assigné pour le moment.
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
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
  empty: {
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});