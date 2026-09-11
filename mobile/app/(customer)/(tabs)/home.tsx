// mobile/app/(customer)/(tabs)/home.tsx
import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  IconArrowUpRight,
  IconBell,
  IconMapPin,
  IconPackage,
  IconRoute,
} from '@tabler/icons-react-native';
import { AppText, Card, IconButton, ScreenContainer } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { recentSearchesStorage, RecentSearch } from '@/services/storage/recentSearches';

export default function CustomerHomeScreen() {
  const { data: profile } = useCustomerProfile();
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // useFocusEffect plutôt qu'un simple useEffect : une recherche faite
  // puis annulée doit réapparaître ici dès le retour sur cet écran, pas
  // seulement au premier montage.
  useFocusEffect(
    useCallback(() => {
      recentSearchesStorage.getAll().then(setRecentSearches);
    }, []),
  );

  function openSearch() {
    router.push('/(customer)/trip-search');
  }

  function openShipmentFlow() {
    router.push('/(customer)/shipment-new');
  }

  function reuseSearch(search: RecentSearch) {
    router.push({
      pathname: '/(customer)/trip-results',
      params: {
        originCityId: search.originCityId,
        originCityName: search.originCityName,
        destinationCityId: search.destinationCityId,
        destinationCityName: search.destinationCityName,
      },
    });
  }

  return (
    <ScreenContainer scroll>
      <View style={styles.header}>
        <View>
          <AppText variant="sm" color="textSecondary">
            Bonjour
          </AppText>
          <AppText variant="xl" weight="semibold">
            {profile?.firstName ?? '…'}
          </AppText>
        </View>
        <IconButton
          icon={<IconBell size={18} color={colors.textPrimary} />}
          accessibilityLabel="Notifications"
          onPress={() => Alert.alert('Bientôt disponible', 'Les notifications arrivent prochainement.')}
        />
      </View>

      <View style={styles.tiles}>
        <Pressable onPress={openSearch} style={[styles.tile, { backgroundColor: colors.primary }]}>
          <IconRoute size={22} color={colors.onPrimary} />
          <AppText variant="base" weight="semibold" color={colors.onPrimary} style={styles.tileLabel}>
            Trouver{'\n'}un trajet
          </AppText>
        </Pressable>
        <Pressable
          onPress={openShipmentFlow}
          style={[styles.tile, { backgroundColor: colors.accent }]}
        >
          <IconPackage size={22} color={colors.onAccent} />
          <AppText variant="base" weight="semibold" color={colors.onAccent} style={styles.tileLabel}>
            Envoyer{'\n'}un colis
          </AppText>
        </Pressable>
      </View>

      <Card onPress={openSearch} style={styles.searchCard}>
        <View style={styles.searchRow}>
          <IconMapPin size={14} color={colors.textSecondary} />
          <AppText variant="base" color="textSecondary">
            Où allez-vous ?
          </AppText>
        </View>
      </Card>

      {recentSearches.length > 0 ? (
        <>
          <AppText variant="base" weight="semibold" style={styles.sectionTitle}>
            Trajets recherchés récemment
          </AppText>
          <View style={styles.recentList}>
            {recentSearches.map((search) => (
              <Card
                key={`${search.originCityId}-${search.destinationCityId}`}
                onPress={() => reuseSearch(search)}
                style={styles.recentCard}
              >
                <View style={styles.recentRow}>
                  <View style={styles.recentIcon}>
                    <IconArrowUpRight size={16} color={colors.successDark} />
                  </View>
                  <View style={styles.rowText}>
                    <AppText variant="sm" weight="semibold">
                      {search.originCityName} → {search.destinationCityName}
                    </AppText>
                    <AppText variant="xs" color="textSecondary">
                      {new Date(search.searchedAt).toLocaleDateString('fr-FR')}
                    </AppText>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        </>
      ) : null}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginBottom: spacing.sm + 2,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tileLabel: {
    marginTop: spacing.sm,
  },
  searchCard: {
    marginBottom: spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  recentList: {
    gap: spacing.xs,
  },
  recentCard: {
    padding: spacing.sm + 2,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  recentIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.successLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: {
    flex: 1,
  },
});
