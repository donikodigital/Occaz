// mobile/src/components/screens/HomeSearchScreen.tsx
//
// [08/10/2026] v1 — Écran ouvert par la barre de recherche de l'accueil. Une seule présentation, deux contenus selon le compte :
//   - client : ses réservations (trajets), ses envois (colis), les chauffeurs qu'il a croisés, et les villes (pour lancer une recherche
//     de trajet vers l'une d'elles) ; sans saisie, ses recherches récentes ;
//   - conducteur : ses trajets et les envois qu'il a acceptés ; sans saisie, un raccourci vers les envois disponibles.
// La recherche porte sur ce que l'application a déjà chargé (les 20 éléments les plus récents de chaque liste) — aucun appel serveur
// supplémentaire, sauf la recherche de villes côté client.

import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  IconArrowLeft,
  IconBuildingSkyscraper,
  IconChevronRight,
  IconClockHour4,
  IconPackage,
  IconRoute,
  IconSearch,
  IconUser,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanEmpty } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useMyTrips } from '@/hooks/useDriverTrips';
import { useAssignedShipments } from '@/hooks/useDriverShipments';
import { useMyBookings } from '@/hooks/useBookings';
import { useMyShipments } from '@/hooks/useShipments';
import { useCitySearch } from '@/hooks/useCities';
import { recentSearchesStorage, formatRecentSearch, type RecentSearch } from '@/services/storage/recentSearches';
import { formatDateShort, formatTime } from '@/utils/date';
import { formatShipmentRoute } from '@/utils/shipmentDisplay';
import { SHIPMENT_STATUS_LABELS } from '@/utils/tripStatusLabels';
import type { Trip } from '@/types/trips.types';
import type { Shipment } from '@/types/shipments.types';

type Section = 'Trajets' | 'Colis' | 'Chauffeurs' | 'Villes';
type IconType = React.ComponentType<{ size?: number; color?: string }>;

interface SearchItem {
  key: string;
  section: Section;
  icon: IconType;
  title: string;
  subtitle: string;
  /** Texte parcouru par la recherche (en plus du titre et du sous-titre). */
  extra?: string;
  onPress: () => void;
}

const SECTION_ORDER: Section[] = ['Trajets', 'Colis', 'Chauffeurs', 'Villes'];
const SECTION_ICON: Record<Section, IconType> = {
  Trajets: IconRoute,
  Colis: IconPackage,
  Chauffeurs: IconUser,
  Villes: IconBuildingSkyscraper,
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

function matches(item: SearchItem, terms: string[]): boolean {
  const haystack = normalize(`${item.title} ${item.subtitle} ${item.extra ?? ''}`);
  return terms.every((term) => haystack.includes(term));
}

function fullName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`.trim();
}

function tripSubtitle(trip: Pick<Trip, 'departureAt'>): string {
  return `${formatDateShort(trip.departureAt)} · ${formatTime(trip.departureAt)}`;
}

function shipmentTitle(shipment: Shipment): string {
  return formatShipmentRoute(shipment) ?? shipment.recipientName;
}

// ---------------------------------------------------------------------------
// Présentation commune
// ---------------------------------------------------------------------------

function SearchShell({
  placeholder,
  query,
  onChangeQuery,
  items,
  loading,
  idle,
  emptyAction,
}: {
  placeholder: string;
  query: string;
  onChangeQuery: (value: string) => void;
  items: SearchItem[];
  loading?: boolean;
  idle: React.ReactNode;
  emptyAction?: React.ReactNode;
}) {
  const hasQuery = query.trim().length > 0;

  const grouped = SECTION_ORDER.map((section) => ({
    section,
    rows: items.filter((item) => item.section === section),
  })).filter((group) => group.rows.length > 0);

  return (
    <ScreenContainer scroll>
      <View style={styles.searchRow}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        >
          <IconArrowLeft size={20} color={OCEAN.deep} />
        </Pressable>
        <View style={styles.inputWrap}>
          <IconSearch size={18} color={OCEAN.base} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            style={styles.input}
            accessibilityLabel={placeholder}
          />
          {hasQuery ? (
            <Pressable onPress={() => onChangeQuery('')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Effacer">
              <IconX size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!hasQuery ? (
        idle
      ) : grouped.length === 0 ? (
        <View style={styles.emptyWrap}>
          <OceanEmpty
            icon={<IconSearch size={28} color={OCEAN.base} />}
            title={loading ? 'Recherche…' : 'Aucun résultat'}
            text={loading ? 'Un instant.' : 'Essayez avec une ville, un nom, ou une partie du mot.'}
            action={emptyAction}
          />
        </View>
      ) : (
        grouped.map((group) => {
          const SectionIcon = SECTION_ICON[group.section];
          return (
            <View key={group.section} style={styles.group}>
              <View style={styles.groupHeader}>
                <SectionIcon size={15} color={OCEAN.base} />
                <AppText variant="xs" weight="bold" color={OCEAN.deep} style={styles.groupTitle}>
                  {group.section.toUpperCase()}
                </AppText>
              </View>
              <View style={styles.groupRows}>
                {group.rows.map((item) => {
                  const Icon = item.icon;
                  return (
                    <OceanCard key={item.key} onPress={item.onPress} style={styles.resultRow} accessibilityLabel={item.title}>
                      <View style={styles.resultIcon}>
                        <Icon size={19} color={OCEAN.base} />
                      </View>
                      <View style={styles.resultText}>
                        <AppText variant="sm" weight="semibold" numberOfLines={1}>
                          {item.title}
                        </AppText>
                        <AppText variant="xs" color="textSecondary" numberOfLines={1}>
                          {item.subtitle}
                        </AppText>
                      </View>
                      <IconChevronRight size={16} color={colors.textMuted} />
                    </OceanCard>
                  );
                })}
              </View>
            </View>
          );
        })
      )}
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function CustomerSearch() {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentSearch[]>([]);
  const bookings = useMyBookings().data?.data ?? [];
  const shipments = useMyShipments().data?.data ?? [];
  const trimmed = query.trim();
  const cities = useCitySearch(trimmed);

  useFocusEffect(
    useCallback(() => {
      recentSearchesStorage.getAll().then(setRecent);
    }, []),
  );

  const items = useMemo<SearchItem[]>(() => {
    const result: SearchItem[] = [];

    for (const booking of bookings) {
      const trip = booking.trip;
      if (!trip) continue;
      const driverName = trip.driver ? fullName(trip.driver) : '';
      result.push({
        key: `b-${booking.id}`,
        section: 'Trajets',
        icon: IconRoute,
        title: `${trip.originCity.name} → ${trip.destinationCity.name}`,
        subtitle: driverName ? `${tripSubtitle(trip)} · ${driverName}` : tripSubtitle(trip),
        onPress: () => router.push(`/(customer)/booking/${booking.id}`),
      });
    }

    for (const shipment of shipments) {
      const driverName = shipment.driver ? fullName(shipment.driver) : '';
      result.push({
        key: `s-${shipment.id}`,
        section: 'Colis',
        icon: IconPackage,
        title: shipmentTitle(shipment),
        subtitle: `${shipment.recipientName} · ${SHIPMENT_STATUS_LABELS[shipment.status]}`,
        extra: `${shipment.description ?? ''} ${shipment.category?.name ?? ''} ${driverName}`,
        onPress: () => router.push(`/(customer)/shipment/${shipment.id}`),
      });
    }

    // Chauffeurs : un seul par personne, avec le dernier trajet ou envoi qui les relie au client.
    const drivers = new Map<string, SearchItem & { count: number }>();
    for (const booking of bookings) {
      const driver = booking.trip?.driver;
      if (!driver) continue;
      const known = drivers.get(driver.id);
      if (known) {
        known.count += 1;
        known.subtitle = `${known.count} trajets avec vous`;
      } else {
        drivers.set(driver.id, {
          key: `d-${driver.id}`,
          section: 'Chauffeurs',
          icon: IconUser,
          title: fullName(driver),
          subtitle: '1 trajet avec vous',
          count: 1,
          onPress: () => router.push(`/(customer)/booking/${booking.id}`),
        });
      }
    }
    for (const shipment of shipments) {
      const driver = shipment.driver;
      if (!driver || drivers.has(driver.id)) continue;
      drivers.set(driver.id, {
        key: `d-${driver.id}`,
        section: 'Chauffeurs',
        icon: IconUser,
        title: fullName(driver),
        subtitle: 'Livre un de vos colis',
        count: 1,
        onPress: () => router.push(`/(customer)/shipment/${shipment.id}`),
      });
    }
    result.push(...drivers.values());

    return result;
  }, [bookings, shipments]);

  const terms = useMemo(() => normalize(trimmed).split(/\s+/).filter(Boolean), [trimmed]);

  const filtered = useMemo(() => {
    if (terms.length === 0) return [];
    const local = items.filter((item) => matches(item, terms));
    const cityItems: SearchItem[] = (cities.data?.data ?? []).slice(0, 5).map((city) => ({
      key: `c-${city.id}`,
      section: 'Villes',
      icon: IconBuildingSkyscraper,
      title: city.name,
      subtitle: 'Chercher un trajet vers cette ville',
      onPress: () =>
        router.push({
          pathname: '/(customer)/trip-results',
          params: { destinationCityId: city.id, destinationCityName: city.name },
        }),
    }));
    return [...local, ...cityItems];
  }, [items, terms, cities.data]);

  const idle = (
    <View>
      {recent.length > 0 ? (
        <View style={styles.group}>
          <View style={styles.groupHeader}>
            <IconClockHour4 size={15} color={OCEAN.base} />
            <AppText variant="xs" weight="bold" color={OCEAN.deep} style={styles.groupTitle}>
              RECHERCHES RÉCENTES
            </AppText>
          </View>
          <View style={styles.groupRows}>
            {recent.map((search) => (
              <OceanCard
                key={`${search.originCityId ?? 'all'}-${search.destinationCityId ?? 'all'}`}
                onPress={() =>
                  router.push({
                    pathname: '/(customer)/trip-results',
                    params: {
                      originCityId: search.originCityId,
                      originCityName: search.originCityName,
                      destinationCityId: search.destinationCityId,
                      destinationCityName: search.destinationCityName,
                    },
                  })
                }
                style={styles.resultRow}
              >
                <View style={styles.resultIcon}>
                  <IconClockHour4 size={19} color={OCEAN.base} />
                </View>
                <View style={styles.resultText}>
                  <AppText variant="sm" weight="semibold" numberOfLines={1}>
                    {formatRecentSearch(search)}
                  </AppText>
                  <AppText variant="xs" color="textSecondary">
                    {formatDateShort(search.searchedAt)}
                  </AppText>
                </View>
                <IconChevronRight size={16} color={colors.textMuted} />
              </OceanCard>
            ))}
          </View>
        </View>
      ) : null}
      <AppText variant="sm" color="textSecondary" style={styles.hint}>
        Tapez une ville, le nom d’un chauffeur ou d’un destinataire pour retrouver un trajet ou un colis.
      </AppText>
    </View>
  );

  return (
    <SearchShell
      placeholder="Rechercher un trajet, un colis ou un chauffeur"
      query={query}
      onChangeQuery={setQuery}
      items={filtered}
      loading={cities.isFetching}
      idle={idle}
      emptyAction={
        <Pressable onPress={() => router.push('/(customer)/trip-search')} style={styles.emptyLink} accessibilityRole="button">
          <AppText variant="sm" weight="semibold" color={OCEAN.base}>
            Faire une recherche de trajet
          </AppText>
        </Pressable>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// Conducteur
// ---------------------------------------------------------------------------

function DriverSearch() {
  const [query, setQuery] = useState('');
  const trips = useMyTrips().data?.data ?? [];
  const shipments = useAssignedShipments().data?.data ?? [];

  const items = useMemo<SearchItem[]>(() => {
    const result: SearchItem[] = [];
    for (const trip of trips) {
      result.push({
        key: `t-${trip.id}`,
        section: 'Trajets',
        icon: IconRoute,
        title: `${trip.originCity.name} → ${trip.destinationCity.name}`,
        subtitle: tripSubtitle(trip),
        extra: `${trip.vehicle?.brand ?? ''} ${trip.vehicle?.model ?? ''} ${trip.vehicle?.plateNumber ?? ''}`,
        onPress: () => router.push(`/(driver)/trip/${trip.id}`),
      });
    }
    for (const shipment of shipments) {
      result.push({
        key: `s-${shipment.id}`,
        section: 'Colis',
        icon: IconPackage,
        title: shipmentTitle(shipment),
        subtitle: `${shipment.recipientName} · ${SHIPMENT_STATUS_LABELS[shipment.status]}`,
        extra: `${shipment.senderName} ${shipment.description ?? ''} ${shipment.category?.name ?? ''}`,
        onPress: () => router.push(`/(driver)/shipment/${shipment.id}`),
      });
    }
    return result;
  }, [trips, shipments]);

  const terms = useMemo(() => normalize(query.trim()).split(/\s+/).filter(Boolean), [query]);
  const filtered = useMemo(() => (terms.length === 0 ? [] : items.filter((item) => matches(item, terms))), [items, terms]);

  const availableLink = (
    <Pressable
      onPress={() => router.push('/(driver)/shipment-available')}
      style={styles.emptyLink}
      accessibilityRole="button"
    >
      <AppText variant="sm" weight="semibold" color={OCEAN.base}>
        Voir les envois disponibles
      </AppText>
    </Pressable>
  );

  const idle = (
    <View>
      <OceanCard onPress={() => router.push('/(driver)/shipment-available')} style={styles.resultRow}>
        <View style={[styles.resultIcon, { backgroundColor: OCEAN.goldSoft }]}>
          <IconPackage size={19} color={OCEAN.goldInk} />
        </View>
        <View style={styles.resultText}>
          <AppText variant="sm" weight="semibold">
            Envois disponibles
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Trouver des colis à livrer sur votre route
          </AppText>
        </View>
        <IconChevronRight size={16} color={colors.textMuted} />
      </OceanCard>
      <AppText variant="sm" color="textSecondary" style={styles.hint}>
        Tapez une ville, un nom de destinataire ou une plaque pour retrouver un trajet ou un envoi.
      </AppText>
    </View>
  );

  return (
    <SearchShell
      placeholder="Rechercher un trajet, un envoi ou une ville"
      query={query}
      onChangeQuery={setQuery}
      items={filtered}
      idle={idle}
      emptyAction={availableLink}
    />
  );
}

export function HomeSearchScreen({ role }: { role: 'driver' | 'customer' }) {
  return role === 'driver' ? <DriverSearch /> : <CustomerSearch />;
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.75,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: OCEAN.line,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  group: {
    marginBottom: spacing.lg,
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: spacing.xs,
  },
  groupTitle: {
    letterSpacing: 1,
  },
  groupRows: {
    gap: spacing.xs + 2,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
  },
  resultIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    flex: 1,
    gap: 1,
  },
  hint: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  emptyWrap: {
    marginTop: spacing.lg,
  },
  emptyLink: {
    alignSelf: 'center',
    paddingVertical: spacing.xs,
  },
});
