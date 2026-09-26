// mobile/app/(customer)/trip-results.tsx
//
// v2 — Refonte bleu océan. Bandeau d'itinéraire (départ → arrivée, date,
// passagers), filtre « Vérifiés » en puce, et une carte par trajet : le
// chauffeur (photo, badge vérifié, note), le prix en grand — avec sa devise
// telle que renvoyée par l'API, plus aucune devise écrite en dur — puis
// l'heure de départ, les places (formulation commune « 2 places libres » /
// « Complet ») et « Colis ok ».

import React, { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconChevronRight,
  IconClock,
  IconPackage,
  IconRoute,
  IconRosetteDiscountCheck,
  IconStarFilled,
  IconUsers,
} from '@tabler/icons-react-native';
import { AppText, Avatar, ResponsiveList, ScreenContainer } from '@/components/ui';
import {
  OceanCard,
  OceanChip,
  OceanEmpty,
  OceanHeroCard,
  OceanPill,
  OceanScreenHeader,
} from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useTripSearch } from '@/hooks/useTripSearch';
import { formatMoney } from '@/utils/money';
import { formatDateShort, formatTime } from '@/utils/date';
import { formatSeatsAvailability } from '@/utils/seats';
import type { Trip } from '@/types/trips.types';

function TripCard({ trip, onPress }: { trip: Trip; onPress: () => void }) {
  const initials = `${trip.driver.firstName[0] ?? ''}${trip.driver.lastName[0] ?? ''}`;
  const isFull = trip.availableSeats <= 0;

  return (
    <OceanCard onPress={onPress} style={[styles.card, isFull && styles.cardFull]} accessibilityLabel={`Trajet de ${trip.driver.firstName}`}>
      <View style={styles.cardTop}>
        <Avatar initials={initials} imageUri={trip.driver.photoUrl} />
        <View style={styles.driverInfo}>
          <View style={styles.nameRow}>
            <AppText variant="base" weight="semibold" numberOfLines={1} style={styles.nameText}>
              {trip.driver.firstName} {trip.driver.lastName[0]}.
            </AppText>
            {trip.driver.isVerifiedBadge ? <IconRosetteDiscountCheck size={16} color={OCEAN.base} /> : null}
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
          <AppText variant="lg" weight="bold" color={OCEAN.deep}>
            {formatMoney(trip.customerPricePerSeat ?? trip.pricePerSeat)}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            par place
          </AppText>
        </View>
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.metaRow}>
          <OceanPill label={`Départ ${formatTime(trip.departureAt)}`} icon={<IconClock size={13} color={OCEAN.base} />} />
          <OceanPill
            label={formatSeatsAvailability(trip.availableSeats)}
            tone={isFull ? 'neutral' : 'ocean'}
            icon={<IconUsers size={13} color={isFull ? colors.textSecondary : OCEAN.base} />}
          />
          {trip.allowsShipments ? (
            <OceanPill label="Colis ok" tone="success" icon={<IconPackage size={13} color={colors.successDark} />} />
          ) : null}
        </View>
        <IconChevronRight size={18} color={colors.textMuted} />
      </View>
    </OceanCard>
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

  const passengers = params.passengersCount ?? '1';
  const dateLabel = params.departureDate ? formatDateShort(params.departureDate) : 'Date flexible';

  const header = (
    <View>
      <OceanScreenHeader title="Trajets disponibles" onBack={() => router.back()} />

      <OceanHeroCard style={styles.hero}>
        <View style={styles.heroRoute}>
          <IconRoute size={20} color={OCEAN.sky} />
          <AppText variant="lg" weight="bold" color={OCEAN.onDark} numberOfLines={2} style={styles.heroTitle}>
            {params.originCityName} → {params.destinationCityName}
          </AppText>
        </View>
        <AppText variant="sm" color={OCEAN.sky}>
          {dateLabel} · {passengers} passager{Number(passengers) > 1 ? 's' : ''}
        </AppText>
      </OceanHeroCard>

      <View style={styles.filters}>
        <OceanPill label={data ? `${data.meta.total} trajet${data.meta.total > 1 ? 's' : ''}` : '…'} />
        <OceanChip
          label="Vérifiés"
          active={verifiedOnly}
          onPress={() => setVerifiedOnly((value) => !value)}
          icon={<IconRosetteDiscountCheck size={15} color={verifiedOnly ? OCEAN.onDark : OCEAN.base} />}
        />
      </View>
    </View>
  );

  const emptyState = isLoading ? (
    <View style={styles.loader}>
      <ActivityIndicator color={OCEAN.base} />
    </View>
  ) : isError ? (
    <OceanEmpty
      icon={<IconRoute size={28} color={colors.danger} />}
      title="Impossible de charger les trajets"
      text="Vérifiez votre connexion puis réessayez."
    />
  ) : (
    <OceanEmpty
      icon={<IconRoute size={28} color={OCEAN.base} />}
      title="Aucun trajet pour le moment"
      text={
        verifiedOnly
          ? 'Aucun chauffeur vérifié ne correspond. Retirez le filtre « Vérifiés » pour voir tous les trajets.'
          : 'Aucun trajet ne correspond à cette recherche. Essayez une autre date ou revenez plus tard.'
      }
    />
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <ResponsiveList
        data={data?.data ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => <TripCard trip={item} onPress={() => router.push(`/(customer)/trip/${item.id}`)} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  heroRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroTitle: {
    flex: 1,
  },
  filters: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  loader: {
    paddingTop: spacing.xxxl,
    alignItems: 'center',
  },
  card: {
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  cardFull: {
    opacity: 0.75,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  driverInfo: {
    flex: 1,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  nameText: {
    flexShrink: 1,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceBlock: {
    alignItems: 'flex-end',
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
    paddingTop: spacing.sm + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: OCEAN.line,
  },
  metaRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
});