// mobile/app/(customer)/(tabs)/home.tsx
//
// v2 — Accueil client construit sur le même modèle que l'accueil chauffeur :
// même en-tête (avatar, salutation, cloche avec compteur), mêmes tuiles
// illustrées, même rythme. Les couleurs passent au bleu océan du profil
// chauffeur ; la tuile « Envoyer un colis » garde le jaune des envois, comme
// « Envois disponibles » côté chauffeur.
//   - une grande barre « Où allez-vous ? » : l'action principale ;
//   - les recherches récentes en cartes, avec la date ;
//   - trois repères de confiance (chauffeurs vérifiés, codes de remise,
//     paiement dans l'app).

import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  IconChevronRight,
  IconClockHour4,
  IconKey,
  IconRosetteDiscountCheck,
  IconSearch,
  IconWallet,
} from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { HomeHeader } from '@/components/screens/HomeHeader';
import { TripTileIllustration } from '@/components/illustrations/TripTileIllustration';
import { ShipmentTileIllustration } from '@/components/illustrations/ShipmentTileIllustration';
import { OceanCard, OceanSection } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useAuthStore } from '@/stores/authStore';
import { useCustomerProfile } from '@/hooks/useCustomerProfile';
import { useMyNotifications } from '@/hooks/useNotifications';
import { recentSearchesStorage, RecentSearch } from '@/services/storage/recentSearches';
import { formatDateShort } from '@/utils/date';

const TRUST_POINTS = [
  { icon: IconRosetteDiscountCheck, title: 'Chauffeurs vérifiés', text: 'Un badge signale les profils validés par notre équipe.' },
  { icon: IconKey, title: 'Remise sécurisée', text: 'Chaque récupération et chaque livraison se valide par un code.' },
  { icon: IconWallet, title: 'Paiement dans l’app', text: 'Vous payez depuis l’application, sans argent à remettre en main propre.' },
];

export default function CustomerHomeScreen() {
  const user = useAuthStore((state) => state.user);
  const { data: profile } = useCustomerProfile();
  // Pas d'endpoint compteur dédié — approximation à partir de la première
  // page de notifications, comme sur l'accueil chauffeur.
  const { data: notificationsPage } = useMyNotifications(1);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // useFocusEffect plutôt qu'un simple useEffect : une recherche faite
  // puis annulée doit réapparaître ici dès le retour sur cet écran, pas
  // seulement au premier montage.
  useFocusEffect(
    useCallback(() => {
      recentSearchesStorage.getAll().then(setRecentSearches);
    }, []),
  );

  const unreadCount = notificationsPage?.data.filter((n) => !n.readAt).length ?? 0;
  const initials = profile ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}` : '…';

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
        <HomeHeader
          firstName={profile?.firstName}
          initials={initials}
          photoUri={profile?.photoUrl}
          isVerified={Boolean(user?.isPhoneVerified)}
          unreadCount={unreadCount}
          onPressAvatar={() => router.navigate('/(customer)/(tabs)/profile')}
          onPressNotifications={() => router.push('/(customer)/notifications')}
        />
      </View>

      <View style={styles.tileRow}>
        <Pressable onPress={openSearch} style={[styles.tile, { backgroundColor: OCEAN.base }]}>
          <View style={styles.tileIllustration}>
            <TripTileIllustration />
          </View>
          <AppText variant="base" weight="semibold" color={OCEAN.onDark} style={styles.tileTitle}>
            Trouver un trajet
          </AppText>
          <AppText variant="xs" color={OCEAN.onDark} style={styles.tileSubtitle}>
            Réserver une place
          </AppText>
        </Pressable>
        <Pressable onPress={openShipmentFlow} style={[styles.tile, { backgroundColor: colors.accent }]}>
          <View style={styles.tileIllustration}>
            <ShipmentTileIllustration />
          </View>
          <AppText variant="base" weight="semibold" color={colors.onAccent} style={styles.tileTitle}>
            Envoyer un colis
          </AppText>
          <AppText variant="xs" color={colors.onAccent} style={styles.tileSubtitle}>
            Expédier en toute sécurité
          </AppText>
        </Pressable>
      </View>

      <Pressable
        onPress={openSearch}
        accessibilityRole="button"
        accessibilityLabel="Rechercher un trajet"
        style={({ pressed }) => [styles.searchBar, pressed && styles.pressed]}
      >
        <View style={styles.searchIcon}>
          <IconSearch size={18} color={OCEAN.onDark} />
        </View>
        <View style={styles.searchText}>
          <AppText variant="base" weight="semibold" color={OCEAN.deep}>
            Où allez-vous ?
          </AppText>
          <AppText variant="xs" color="textSecondary">
            Ville de départ, ville d’arrivée, date
          </AppText>
        </View>
        <IconChevronRight size={18} color={OCEAN.base} />
      </Pressable>

      {recentSearches.length > 0 ? (
        <>
          <AppText variant="md" weight="bold" color={OCEAN.deep} style={styles.sectionTitle}>
            Recherches récentes
          </AppText>
          <View style={styles.recentList}>
            {recentSearches.map((search) => (
              <OceanCard
                key={`${search.originCityId}-${search.destinationCityId}`}
                onPress={() => reuseSearch(search)}
                style={styles.recentCard}
                accessibilityLabel={`${search.originCityName} vers ${search.destinationCityName}`}
              >
                <View style={styles.recentIcon}>
                  <IconClockHour4 size={18} color={OCEAN.base} />
                </View>
                <View style={styles.recentText}>
                  <AppText variant="sm" weight="semibold" numberOfLines={1}>
                    {search.originCityName} → {search.destinationCityName}
                  </AppText>
                  <AppText variant="xs" color="textSecondary">
                    {formatDateShort(search.searchedAt)}
                  </AppText>
                </View>
                <IconChevronRight size={16} color={colors.textMuted} />
              </OceanCard>
            ))}
          </View>
        </>
      ) : null}

      <OceanSection
        icon={<IconRosetteDiscountCheck size={16} color={OCEAN.base} />}
        title="Voyager en confiance"
        style={styles.trust}
      >
        {TRUST_POINTS.map((point) => {
          const Icon = point.icon;
          return (
            <View key={point.title} style={styles.trustRow}>
              <View style={styles.trustIcon}>
                <Icon size={18} color={OCEAN.base} />
              </View>
              <View style={styles.trustText}>
                <AppText variant="sm" weight="semibold">
                  {point.title}
                </AppText>
                <AppText variant="xs" color="textSecondary">
                  {point.text}
                </AppText>
              </View>
            </View>
          );
        })}
      </OceanSection>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  header: {
    marginBottom: spacing.lg,
  },
  tileRow: {
    flexDirection: 'row',
    gap: spacing.xs + 2,
    marginBottom: spacing.md,
  },
  tile: {
    flex: 1,
    borderRadius: radius.lg,
    padding: spacing.md,
    minHeight: 140,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  tileIllustration: {
    position: 'absolute',
    top: -14,
    right: -18,
    transform: [{ rotate: '-6deg' }],
  },
  tileTitle: {
    marginTop: spacing.md,
  },
  tileSubtitle: {
    opacity: 0.85,
    marginTop: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: OCEAN.line,
    padding: spacing.sm,
    marginBottom: spacing.lg,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.1,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  searchIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: OCEAN.base,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchText: {
    flex: 1,
    gap: 1,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  recentList: {
    gap: spacing.xs + 2,
    marginBottom: spacing.lg,
  },
  recentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm + 2,
  },
  recentIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentText: {
    flex: 1,
    gap: 1,
  },
  trust: {
    marginBottom: spacing.lg,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  trustIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustText: {
    flex: 1,
    gap: 2,
  },
});