// mobile/app/(customer)/trip-results.tsx
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconArrowLeft,
  IconClock,
  IconPackage,
  IconRosetteDiscountCheck,
  IconStarFilled,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, Avatar, Card, IconButton, ResponsiveList, ScreenContainer } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useTripSearch } from '@/hooks/useTripSearch';
import { formatMoney } from '@/utils/money';
import { formatTime } from '@/utils/date';
import type { Trip } from '@/types/trips.types';

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const initials = `${trip.driver.firstName[0] ?? ''}${trip.driver.lastName[0] ?? ''}`;

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.cardTop}>
        <Avatar initials={initials} imageUri={trip.driver.photoUrl} />
        
        <View style={styles.driverInfo}>
          <View style={styles.nameRow}>
            <AppText variant="base" weight="semibold" numberOfLines={1}>
              {trip.driver.firstName} {trip.driver.lastName[0]}.
            </AppText>
            {trip.driver.isVerifiedBadge ? (
              <IconRosetteDiscountCheck size={15} color={colors.successDark} />
            ) : null}
          </View>
          {trip.driver.averageRating ? (
            <View style={styles.ratingRow}>
              <IconStarFilled size={12} color={colors.accent} />
              <AppText variant="xs" color="textSecondary">
                {trip.driver.averageRating.toFixed(1)} · {trip.driver.completedTripsCount} trajets
              </AppText>
            </View>
          ) : (
            <AppText variant="xs" color="textSecondary">
              Nouveau chauffeur
            </AppText>
          )}
        </View>
        <View style={styles.priceBlock}>
          <AppText variant="lg" weight="semibold">
            {formatMoney(trip.pricePerSeat, '')}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            GNF
          </AppText>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.metaItem}>
          <IconClock size={13} color={colors.textSecondary} />
          <AppText variant="xs" color="textSecondary">
            Départ {formatTime(trip.departureAt)}
          </AppText>
        </View>
        <View style={styles.metaItem}>
          <IconUsers size={13} color={colors.textSecondary} />
          <AppText variant="xs" color="textSecondary">
            {trip.availableSeats} place{trip.availableSeats > 1 ? 's' : ''}
          </AppText>
        </View>
        {trip.allowsShipments ? (
          <View style={styles.metaItem}>
            <IconPackage size={13} color={colors.successDark} />
            <AppText variant="xs" color="success">
              Colis ok
            </AppText>
          </View>
        ) : null}
      </View>
    </Card>
  );
}

export default function TripResultsScreen() {
  const params = useLocalSearchParams<{
    originCityId: string;
    originCityName: string;
    destinationCityId: string;
    destinationCityName: string;
    departureDate?: string;
    passengersCount?: string;
  }>();
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const searchParams = useMemo(
    () => ({
      originCityId: params.originCityId,
      destinationCityId: params.destinationCityId,
      departureDate: params.departureDate || undefined,
      passengersCount: params.passengersCount ? Number(params.passengersCount) : 1,
      verifiedDriverOnly: verifiedOnly || undefined,
      limit: 20,
    }),
    [params, verifiedOnly],
  );

  const { data, isLoading, isError } = useTripSearch(
    searchParams,
    Boolean(params.originCityId && params.destinationCityId),
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <View style={styles.header}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <View style={styles.headerText}>
          <AppText variant="md" weight="semibold" numberOfLines={1}>
            {params.originCityName} → {params.destinationCityName}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {params.departureDate ?? 'Date flexible'} · {params.passengersCount ?? '1'} passager(s)
          </AppText>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.countChip}>
          <AppText variant="xs" weight="semibold" color="primary">
            {data ? `${data.meta.total} trajet${data.meta.total > 1 ? 's' : ''}` : '…'}
          </AppText>
        </View>
        <Pressable
          onPress={() => setVerifiedOnly((v) => !v)}
          style={[styles.filterChip, verifiedOnly && styles.filterChipActive]}
        >
          <IconRosetteDiscountCheck size={13} color={verifiedOnly ? colors.onPrimary : colors.textPrimary} />
          <AppText variant="xs" weight="semibold" color={verifiedOnly ? colors.onPrimary : 'textPrimary'}>
            Vérifiés
          </AppText>
        </Pressable>
      </View>

      {isError ? (
        <AppText variant="sm" color="danger" style={styles.centerMessage}>
          Impossible de charger les trajets — réessayez.
        </AppText>
      ) : null}

      <ResponsiveList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          !isLoading && !isError
            ? () => (
                <AppText variant="sm" color="textMuted" style={styles.centerMessage}>
                  Aucun trajet ne correspond à cette recherche pour le moment.
                </AppText>
              )
            : undefined
        }
        renderItem={({ item }) => (
          <TripCard trip={item} onPress={() => router.push(`/(customer)/trip/${item.id}`)} />
        )}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  headerText: {
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  countChip: {
    backgroundColor: colors.primaryLight,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    gap: spacing.sm + 2,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  cardBottom: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  centerMessage: {
    textAlign: 'center',
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
});
