// mobile/app/(driver)/shipment-available.tsx
//
// v3 — Plus de force et de repères. Logique inchangée (mêmes filtres de
// ville, même rafraîchissement automatique toutes les 20 s, même feuille
// d'acceptation) ; tout ce qui se voit est refait.
//   - Bandeau d'identité aux couleurs de la tuile « Envois disponibles » de
//     l'accueil (jaune + illustration de colis) : on sait où l'on est. Il
//     porte le nombre de demandes ouvertes.
//   - Indicateur « En direct » : point qui pulse et « actualisé il y a 8 s »,
//     pour savoir que la liste vit toute seule.
//   - Itinéraire : départ et arrivée reliés par un tracé, avec « Inverser »
//     et « Effacer », au lieu de deux champs côte à côte.
//   - « Premier arrivé, premier servi » devient un vrai encadré, et non plus
//     une ligne de petit texte.
//   - États : squelettes pendant le chargement ; sans demande, un radar qui
//     guette + les 3 étapes du parcours ; en erreur, une carte claire.
//
// v2 — Refonte de l'écran "Envois disponibles" : filtres d'itinéraire
// lisibles (départ → arrivée), cartes de demandes (composant isolé
// ShipmentRequestCard) avec le gain net du chauffeur en évidence, et
// acceptation en un geste via AcceptShipmentSheet (choix du trajet dans la
// feuille, plus besoin d'ouvrir un écran de détail avant d'accepter).
// La liste se rafraîchit toute seule tant que l'écran est visible — en
// attendant les notifications push, pour que "premier arrivé, premier
// servi" ne dépende pas d'un rafraîchissement manuel.
//
// v1 — Liste simple avec deux pastilles de filtre par ville.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowsUpDown,
  IconBolt,
  IconChevronRight,
  IconPackage,
  IconRefresh,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, Button, IconButton, ResponsiveList, ScreenContainer } from '@/components/ui';
import { AcceptShipmentSheet } from '@/components/screens/AcceptShipmentSheet';
import { ShipmentRequestCard } from '@/components/screens/ShipmentRequestCard';
import { ShipmentTileIllustration } from '@/components/illustrations/ShipmentTileIllustration';
import { colors, radius, spacing } from '@/theme';
import { useAvailableShipments } from '@/hooks/useDriverShipments';
import { ApiError } from '@/services/api/ApiError';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import type { AvailableShipment } from '@/types/shipments.types';
import type { City } from '@/types/geography.types';

/** Intervalle de rafraîchissement automatique de la liste, tant que l'écran est au premier plan. */
const REFRESH_INTERVAL_MS = 20_000;

/** Les animations natives n'existent pas sur le web : on les y désactive plutôt que d'afficher un avertissement. */
const USE_NATIVE_DRIVER = Platform.OS !== 'web';

/** Hauteur d'une ligne de l'itinéraire : le tracé est positionné à partir d'elle. */
const ROUTE_ROW_HEIGHT = 60;
const ROUTE_ROW_GAP = spacing.xs;
const RAIL_DOT = 12;

const STEPS = [
  { title: 'Acceptez', text: 'Choisissez une demande et le trajet sur lequel vous la prenez.' },
  { title: 'Récupérez', text: 'Validez la prise du colis avec le code de récupération.' },
  { title: 'Livrez', text: 'Validez la remise au destinataire avec le code de livraison.' },
];

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

/** Point qui pulse + « actualisé il y a … ». Isolé pour que le tic-tac d'une seconde ne redessine pas la liste. */
function LiveIndicator({ lastUpdatedAt, isRefreshing }: { lastUpdatedAt: number | null; isRefreshing: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  let label = 'Connexion…';
  if (isRefreshing) {
    label = 'Actualisation…';
  } else if (lastUpdatedAt !== null) {
    const seconds = Math.max(0, Math.round((now - lastUpdatedAt) / 1000));
    if (seconds < 5) label = 'À l’instant';
    else if (seconds < 60) label = `Actualisé il y a ${seconds} s`;
    else label = `Actualisé il y a ${Math.floor(seconds / 60)} min`;
  }

  return (
    <View style={styles.live}>
      <View style={styles.liveDotWrap}>
        <Animated.View
          style={[
            styles.liveHalo,
            {
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
            },
          ]}
        />
        <View style={styles.liveDot} />
      </View>
      <View>
        <AppText variant="xs" weight="bold" color={colors.onAccent}>
          En direct
        </AppText>
        <AppText variant="xs" color={colors.onAccent} style={styles.liveLabel}>
          {label}
        </AppText>
      </View>
    </View>
  );
}

/** Radar : deux ondes qui s'élargissent autour d'un colis — « on guette les nouvelles demandes ». */
function Radar() {
  const first = useRef(new Animated.Value(0)).current;
  const second = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wave = (value: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, { toValue: 1, duration: 2200, easing: Easing.out(Easing.quad), useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: USE_NATIVE_DRIVER }),
        ]),
      );
    const loops = [wave(first, 0), wave(second, 1100)];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [first, second]);

  const ringStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.5] }) }],
  });

  return (
    <View style={styles.radar}>
      <Animated.View style={[styles.radarRing, ringStyle(first)]} />
      <Animated.View style={[styles.radarRing, ringStyle(second)]} />
      <View style={styles.radarCore}>
        <IconPackage size={30} color={colors.accentDark} />
      </View>
    </View>
  );
}

/** Carte grise qui respire pendant le chargement. */
function SkeletonCard() {
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: USE_NATIVE_DRIVER }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return <Animated.View style={[styles.skeleton, { opacity }]} />;
}

// ---------------------------------------------------------------------------
// Blocs
// ---------------------------------------------------------------------------

function Hero({
  count,
  isLoading,
  lastUpdatedAt,
  isRefreshing,
  onRefresh,
}: {
  count: number;
  isLoading: boolean;
  lastUpdatedAt: number | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <View style={styles.hero}>
      <View style={styles.heroCircleLarge} />
      <View style={styles.heroCircleSmall} />
      <View style={styles.heroIllustration}>
        <ShipmentTileIllustration />
      </View>

      <View style={styles.heroTop}>
        <IconButton
          icon={<IconArrowLeft size={18} color={colors.textPrimary} />}
          accessibilityLabel="Retour"
          onPress={() => router.back()}
        />
        <IconButton
          icon={
            isRefreshing ? (
              <ActivityIndicator size="small" color={colors.textPrimary} />
            ) : (
              <IconRefresh size={18} color={colors.textPrimary} />
            )
          }
          accessibilityLabel="Actualiser la liste"
          onPress={onRefresh}
          disabled={isRefreshing}
        />
      </View>

      <View style={styles.heroBody}>
        <AppText variant="xxl" weight="bold" color={colors.onAccent}>
          Envois disponibles
        </AppText>
        <AppText variant="sm" color={colors.onAccent} style={styles.heroSubtitle}>
          Acceptez une demande, livrez le colis et touchez votre gain net.
        </AppText>
      </View>

      <View style={styles.heroStats}>
        <View style={styles.statTile}>
          <AppText variant="xxl" weight="bold" color={colors.onAccent}>
            {isLoading ? '…' : count}
          </AppText>
          <AppText variant="xs" color={colors.onAccent} style={styles.liveLabel}>
            {count > 1 ? 'demandes ouvertes' : 'demande ouverte'}
          </AppText>
        </View>
        <View style={styles.statTileWide}>
          <LiveIndicator lastUpdatedAt={lastUpdatedAt} isRefreshing={isRefreshing} />
        </View>
      </View>
    </View>
  );
}

function RouteRow({
  index,
  label,
  value,
  placeholder,
  onPress,
  onClear,
}: {
  index: 0 | 1;
  label: string;
  value?: string;
  placeholder: string;
  onPress: () => void;
  onClear: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value ?? placeholder}`}
      style={({ pressed }) => [
        styles.routeField,
        { top: index * (ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP) },
        value ? styles.routeFieldActive : null,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.routeFieldText}>
        <AppText variant="xs" color="textMuted">
          {label}
        </AppText>
        <AppText variant="base" weight="semibold" color={value ? 'textPrimary' : 'textSecondary'} numberOfLines={1}>
          {value ?? placeholder}
        </AppText>
      </View>
      {value ? (
        <Pressable
          onPress={onClear}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Effacer ${label.toLowerCase()}`}
        >
          <IconX size={18} color={colors.textMuted} />
        </Pressable>
      ) : (
        <IconChevronRight size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

function RoutePlanner({
  originName,
  destinationName,
  onPickOrigin,
  onPickDestination,
  onClearOrigin,
  onClearDestination,
  onSwap,
  onClearAll,
}: {
  originName?: string;
  destinationName?: string;
  onPickOrigin: () => void;
  onPickDestination: () => void;
  onClearOrigin: () => void;
  onClearDestination: () => void;
  onSwap: () => void;
  onClearAll: () => void;
}) {
  const hasFilters = Boolean(originName || destinationName);
  const firstDotTop = ROUTE_ROW_HEIGHT / 2 - RAIL_DOT / 2;
  const secondDotTop = ROUTE_ROW_HEIGHT + ROUTE_ROW_GAP + ROUTE_ROW_HEIGHT / 2 - RAIL_DOT / 2;

  return (
    <View style={styles.planner}>
      <View style={styles.plannerHeader}>
        <View style={styles.plannerTitle}>
          <AppText variant="sm" weight="semibold">
            Itinéraire
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {hasFilters ? 'Filtre actif' : 'Toutes les villes — touchez pour filtrer'}
          </AppText>
        </View>
        {hasFilters ? (
          <View style={styles.plannerActions}>
            <Pressable
              onPress={onSwap}
              accessibilityRole="button"
              accessibilityLabel="Inverser départ et arrivée"
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <IconArrowsUpDown size={14} color={colors.primary} />
              <AppText variant="xs" weight="semibold" color="primary">
                Inverser
              </AppText>
            </Pressable>
            <Pressable
              onPress={onClearAll}
              accessibilityRole="button"
              accessibilityLabel="Effacer les filtres"
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <AppText variant="xs" weight="semibold" color="textSecondary">
                Effacer
              </AppText>
            </Pressable>
          </View>
        ) : null}
      </View>

      <View style={[styles.routeBox, { height: ROUTE_ROW_HEIGHT * 2 + ROUTE_ROW_GAP }]}>
        {/* Tracé départ → arrivée */}
        <View style={[styles.railDot, styles.railDotStart, { top: firstDotTop }]} />
        <View
          style={[
            styles.railLine,
            { top: firstDotTop + RAIL_DOT, height: secondDotTop - firstDotTop - RAIL_DOT },
          ]}
        />
        <View style={[styles.railDot, styles.railDotEnd, { top: secondDotTop }]} />

        <RouteRow
          index={0}
          label="Départ"
          value={originName}
          placeholder="Toutes les villes"
          onPress={onPickOrigin}
          onClear={onClearOrigin}
        />
        <RouteRow
          index={1}
          label="Arrivée"
          value={destinationName}
          placeholder="Toutes les villes"
          onPress={onPickDestination}
          onClear={onClearDestination}
        />
      </View>
    </View>
  );
}

function StepsCard() {
  return (
    <View style={styles.stepsCard}>
      <AppText variant="sm" weight="semibold">
        Comment ça marche
      </AppText>
      {STEPS.map((step, index) => (
        <View key={step.title} style={styles.step}>
          <View style={styles.stepBadge}>
            <AppText variant="xs" weight="bold" color={colors.onAccent}>
              {index + 1}
            </AppText>
          </View>
          <View style={styles.stepText}>
            <AppText variant="sm" weight="semibold">
              {step.title}
            </AppText>
            <AppText variant="xs" color="textSecondary">
              {step.text}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

function RulesBanner() {
  return (
    <View style={styles.rules}>
      <View style={styles.rulesIcon}>
        <IconBolt size={18} color={colors.onAccent} />
      </View>
      <View style={styles.rulesText}>
        <AppText variant="sm" weight="semibold">
          Premier arrivé, premier servi
        </AppText>
        <AppText variant="xs" color="textSecondary">
          Dès qu’un chauffeur accepte, l’envoi disparaît de la liste des autres. Tous les chauffeurs validés voient ces
          demandes, avec ou sans trajet.
        </AppText>
      </View>
    </View>
  );
}

function Separator() {
  return <View style={{ height: spacing.sm }} />;
}

// ---------------------------------------------------------------------------
// Écran
// ---------------------------------------------------------------------------

export default function AvailableShipmentsScreen() {
  const [originCity, setOriginCity] = useState<City | null>(null);
  const [destinationCity, setDestinationCity] = useState<City | null>(null);
  const [selectedShipment, setSelectedShipment] = useState<AvailableShipment | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const citySelection = useCitySelectionStore((state) => state.selection);
  const consumeCitySelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);

  useEffect(() => {
    if (!citySelection) return;
    if (citySelection.field === 'available-origin') setOriginCity(citySelection.city);
    else if (citySelection.field === 'available-destination') setDestinationCity(citySelection.city);
    consumeCitySelection();
  }, [citySelection, consumeCitySelection]);

  const { data, isLoading, isError, error, isRefetching, refetch } = useAvailableShipments({
    originCityId: originCity?.id,
    destinationCityId: destinationCity?.id,
    limit: 20,
  });

  /** Rafraîchit la liste et note l'heure, pour l'indicateur « actualisé il y a … ». */
  const refresh = useCallback(() => {
    void refetch().then(() => setLastUpdatedAt(Date.now()));
  }, [refetch]);

  // Premier affichage : la liste vient d'être chargée.
  useEffect(() => {
    if (!isLoading && lastUpdatedAt === null) setLastUpdatedAt(Date.now());
  }, [isLoading, lastUpdatedAt]);

  // Rafraîchit à chaque retour sur l'écran puis toutes les 20 s tant qu'il reste visible.
  useFocusEffect(
    useCallback(() => {
      refresh();
      const timer = setInterval(refresh, REFRESH_INTERVAL_MS);
      return () => clearInterval(timer);
    }, [refresh]),
  );

  function openPicker(field: 'available-origin' | 'available-destination') {
    openCityPicker(field);
    router.push('/(driver)/select-city');
  }

  function clearFilters() {
    setOriginCity(null);
    setDestinationCity(null);
  }

  function swapCities() {
    setOriginCity(destinationCity);
    setDestinationCity(originCity);
  }

  const shipments = data?.data ?? [];
  const hasFilters = Boolean(originCity || destinationCity);

  const listHeader = (
    <View>
      <Hero
        count={shipments.length}
        isLoading={isLoading}
        lastUpdatedAt={lastUpdatedAt}
        isRefreshing={isRefetching}
        onRefresh={refresh}
      />
      <RoutePlanner
        originName={originCity?.name}
        destinationName={destinationCity?.name}
        onPickOrigin={() => openPicker('available-origin')}
        onPickDestination={() => openPicker('available-destination')}
        onClearOrigin={() => setOriginCity(null)}
        onClearDestination={() => setDestinationCity(null)}
        onSwap={swapCities}
        onClearAll={clearFilters}
      />
      {shipments.length > 0 ? (
        <>
          <RulesBanner />
          <View style={styles.sectionHeader}>
            <AppText variant="md" weight="semibold">
              Demandes ouvertes
            </AppText>
            <View style={styles.countPill}>
              <AppText variant="xs" weight="bold" color={colors.onAccent}>
                {shipments.length}
              </AppText>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );

  const emptyState = isLoading ? (
    <View style={styles.skeletons}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </View>
  ) : isError ? (
    <View style={styles.errorCard}>
      <View style={styles.errorIcon}>
        <IconAlertTriangle size={24} color={colors.danger} />
      </View>
      <AppText variant="md" weight="semibold" align="center">
        Impossible de charger les envois
      </AppText>
      <AppText variant="sm" color="textSecondary" align="center">
        {error instanceof ApiError ? error.message : 'Vérifiez votre connexion puis réessayez.'}
      </AppText>
      <Button label="Réessayer" variant="outline" size="md" fullWidth={false} onPress={refresh} />
    </View>
  ) : (
    <View style={styles.empty}>
      <Radar />
      <AppText variant="md" weight="semibold" align="center">
        {hasFilters ? 'Aucun envoi sur cet itinéraire' : 'On guette les nouvelles demandes'}
      </AppText>
      <AppText variant="sm" color="textSecondary" align="center">
        {hasFilters
          ? 'Essayez avec d’autres villes ou retirez les filtres.'
          : 'Dès qu’un client publie un colis, il apparaît ici. La liste se met à jour toute seule.'}
      </AppText>
      {hasFilters ? (
        <Button label="Effacer les filtres" variant="outline" size="md" fullWidth={false} onPress={clearFilters} />
      ) : (
        <>
          <StepsCard />
          <Button
            label="Voir mon activité"
            variant="ghost"
            size="md"
            fullWidth={false}
            onPress={() => router.navigate('/(driver)/(tabs)/trips')}
          />
        </>
      )}
    </View>
  );

  return (
    <ScreenContainer padded={false} maxWidth="wide">
      <ResponsiveList
        data={shipments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        renderItem={({ item }) => <ShipmentRequestCard shipment={item} onAccept={() => setSelectedShipment(item)} />}
      />

      <AcceptShipmentSheet
        shipment={selectedShipment}
        onClose={() => setSelectedShipment(null)}
        onAccepted={(shipmentId) => {
          setSelectedShipment(null);
          router.push(`/(driver)/shipment/${shipmentId}`);
        }}
        onAttemptFailed={refresh}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  // Bandeau
  hero: {
    backgroundColor: colors.accent,
    borderRadius: 28,
    padding: spacing.md,
    gap: spacing.md,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  heroCircleLarge: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroCircleSmall: {
    position: 'absolute',
    bottom: -50,
    left: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heroIllustration: {
    position: 'absolute',
    top: 34,
    right: -22,
    transform: [{ rotate: '-6deg' }],
    opacity: 0.9,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroBody: {
    gap: 4,
  },
  heroSubtitle: {
    opacity: 0.85,
    maxWidth: '78%',
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statTile: {
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    minWidth: 110,
  },
  statTileWide: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  liveLabel: {
    opacity: 0.8,
  },
  liveDotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveHalo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.success,
  },

  // Itinéraire
  planner: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.md,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  plannerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  plannerTitle: {
    flex: 1,
    gap: 2,
  },
  plannerActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
  },
  routeBox: {
    position: 'relative',
  },
  railDot: {
    position: 'absolute',
    left: 2,
    width: RAIL_DOT,
    height: RAIL_DOT,
    borderRadius: RAIL_DOT / 2,
  },
  railDotStart: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  railDotEnd: {
    backgroundColor: colors.primary,
  },
  railLine: {
    position: 'absolute',
    left: 7,
    width: 2,
    backgroundColor: colors.border,
  },
  routeField: {
    position: 'absolute',
    left: 26,
    right: 0,
    height: ROUTE_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  routeFieldActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  routeFieldText: {
    flex: 1,
    gap: 2,
  },

  // Repères dans la liste
  rules: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.accentLight,
    borderRadius: 20,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  rulesIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rulesText: {
    flex: 1,
    gap: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  countPill: {
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    paddingHorizontal: 7,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // États
  skeletons: {
    gap: spacing.sm,
  },
  skeleton: {
    height: 132,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  empty: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
  },
  radar: {
    width: 130,
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  radarRing: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 2,
    borderColor: colors.accent,
  },
  radarCore: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepsCard: {
    alignSelf: 'stretch',
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm + 2,
    marginTop: spacing.xs,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    gap: 2,
  },
  errorCard: {
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  errorIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});