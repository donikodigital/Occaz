// mobile/app/(driver)/(tabs)/trips.tsx
//
// v2 — Habillage bleu océan, comme l'espace client : titre, deux segments
// (Trajets / Envois) avec leur compteur, cartes ombrées par trajet ou
// envoi, états vides avec une action (publier un trajet, voir les envois
// disponibles). Logique inchangée : mêmes hooks, mêmes listes.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanPill, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useAssignedShipments } from '@/hooks/useDriverShipments';
import { formatDateShort, formatTime } from '@/utils/date';
import { driverNetAmount, formatWindow } from '@/utils/shipmentDisplay';
import { formatMoney } from '@/utils/money';
import { SHIPMENT_STATUS_LABELS, SHIPMENT_STATUS_TONE, TRIP_STATUS_LABELS, TRIP_STATUS_TONE } from '@/utils/tripStatusLabels';
import type { Trip } from '@/types/trips.types';
import type { Shipment } from '@/types/shipments.types';

type Segment = 'trips' | 'shipments';

/** Les tons existants (Badge) sont réutilisés tels quels sur les pastilles Ocean — seul le nom « primary » devient « ocean ». */
const TONE_TO_PILL: Record<'primary' | 'success' | 'danger' | 'neutral', OceanPillTone> = {
  primary: 'ocean',
  success: 'success',
  danger: 'danger',
  neutral: 'neutral',
};

function TripRow({ trip }: { trip: Trip }) {
  return (
    <OceanCard onPress={() => router.push(`/(driver)/trip/${trip.id}`)} style={styles.row} accessibilityLabel="Ouvrir le trajet">
      <View style={styles.rowIcon}>
        <IconRoute size={19} color={OCEAN.base} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {trip.originCity.name} → {trip.destinationCity.name}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {formatDateShort(trip.departureAt)} · {formatTime(trip.departureAt)}
        </AppText>
      </View>
      <OceanPill label={TRIP_STATUS_LABELS[trip.status]} tone={TONE_TO_PILL[TRIP_STATUS_TONE[trip.status]]} />
    </OceanCard>
  );
}

function ShipmentRow({ shipment }: { shipment: Shipment }) {
  return (
    <OceanCard onPress={() => router.push(`/(driver)/shipment/${shipment.id}`)} style={styles.row} accessibilityLabel="Ouvrir l'envoi">
      <View style={[styles.rowIcon, styles.rowIconShipment]}>
        <IconPackage size={19} color={OCEAN.goldInk} />
      </View>
      <View style={styles.rowText}>
        <AppText variant="sm" weight="semibold" numberOfLines={1}>
          {shipment.recipientName}
        </AppText>
        <AppText variant="xs" color="textSecondary" numberOfLines={1}>
          Vous recevrez {formatMoney(driverNetAmount(shipment), shipment.currency?.isoCode)} · {formatWindow(shipment)}
        </AppText>
      </View>
      <OceanPill label={SHIPMENT_STATUS_LABELS[shipment.status]} tone={TONE_TO_PILL[SHIPMENT_STATUS_TONE[shipment.status]]} />
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

export default function DriverActivityScreen() {
  const [segment, setSegment] = useState<Segment>('trips');
  const tripsQuery = useMyTrips();
  const shipmentsQuery = useAssignedShipments();

  const trips = tripsQuery.data?.data ?? [];
  const shipments = shipmentsQuery.data?.data ?? [];
  const isLoading = segment === 'trips' ? tripsQuery.isLoading : shipmentsQuery.isLoading;

  const header = (
    <View>
      <View style={styles.titleBlock}>
        <AppText variant="xxl" weight="bold" color={OCEAN.deep}>
          Mon activité
        </AppText>
        <AppText variant="sm" color="textSecondary">
          Vos trajets et les envois que vous avez acceptés.
        </AppText>
      </View>

      <Segmented
        value={segment}
        onChange={setSegment}
        items={[
          { id: 'trips', label: 'Trajets', count: tripsQuery.data ? trips.length : undefined },
          { id: 'shipments', label: 'Envois', count: shipmentsQuery.data ? shipments.length : undefined },
        ]}
      />
    </View>
  );

  const emptyTrips = (
    <OceanEmpty
      icon={<IconRoute size={28} color={OCEAN.base} />}
      title="Aucun trajet créé"
      text="Publiez un trajet pour que des passagers puissent réserver."
      action={<OceanButton label="Publier un trajet" onPress={() => router.push('/(driver)/trip-new')} style={styles.emptyButton} />}
    />
  );

  const emptyShipments = (
    <OceanEmpty
      icon={<IconPackage size={28} color={OCEAN.base} />}
      title="Aucun envoi accepté"
      text="Les demandes d'envoi que vous acceptez apparaîtront ici, avec leur suivi."
      action={
        <OceanButton
          label="Voir les envois disponibles"
          onPress={() => router.push('/(driver)/shipment-available')}
          style={styles.emptyButton}
        />
      }
    />
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      {segment === 'trips' ? (
        <ResponsiveList
          data={trips}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListHeaderComponent={header}
          ListEmptyComponent={!isLoading ? emptyTrips : undefined}
          renderItem={({ item }) => <TripRow trip={item} />}
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
  emptyButton: {
    alignSelf: 'stretch',
    marginTop: spacing.xs,
  },
});