// mobile/src/components/home/CurrentTripCard.tsx
//
// [08/10/2026] v1 — Carte « Détails du trajet » de l'accueil, d'après la maquette : la carte de la route (ou, sans coordonnées ni jeton
// Mapbox, un tracé départ → arrivée dessiné ici), le titre « Trajet partagé · Conakry à Kindia », quatre colonnes (Date, Places, Type,
// Prix) et deux boutons. Présentationnelle : l'écran qui l'utilise calcule les valeurs.

import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { IconMapPin, IconFlag } from '@tabler/icons-react-native';
import { AppText, RouteMap, type RouteMapPoint } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

const MAP_HEIGHT = 150;
const hasMapToken = Boolean(process.env.EXPO_PUBLIC_MAPBOX_TOKEN);

export interface TripColumn {
  label: string;
  value: string;
}

export interface TripCardAction {
  label: string;
  onPress: () => void;
  loading?: boolean;
}

export interface CurrentTripCardProps {
  /** « Trajet partagé » */
  eyebrow: string;
  originName: string;
  destinationName: string;
  origin?: RouteMapPoint | null;
  destination?: RouteMapPoint | null;
  columns: TripColumn[];
  primary: TripCardAction;
  secondary: TripCardAction;
  onPress?: () => void;
}

/** Tracé de repli : deux points reliés par un trait pointillé, avec le nom des villes. */
function RoutePlaceholder({ originName, destinationName }: { originName: string; destinationName: string }) {
  return (
    <View style={styles.placeholder}>
      <View style={styles.placeholderCircle} />
      <View style={styles.placeholderRoute}>
        <View style={styles.placeholderPoint}>
          <View style={[styles.placeholderBadge, { backgroundColor: OCEAN.base }]}>
            <IconMapPin size={16} color={OCEAN.onDark} />
          </View>
          <AppText variant="xs" weight="semibold" color={OCEAN.deep} numberOfLines={1} style={styles.placeholderCity}>
            {originName}
          </AppText>
        </View>
        <View style={styles.placeholderDashes}>
          {Array.from({ length: 9 }).map((_, index) => (
            <View key={index} style={styles.placeholderDash} />
          ))}
        </View>
        <View style={styles.placeholderPoint}>
          <View style={[styles.placeholderBadge, { backgroundColor: OCEAN.gold }]}>
            <IconFlag size={16} color={OCEAN.goldInk} />
          </View>
          <AppText variant="xs" weight="semibold" color={OCEAN.deep} numberOfLines={1} style={styles.placeholderCity}>
            {destinationName}
          </AppText>
        </View>
      </View>
    </View>
  );
}

export function CurrentTripCard({
  eyebrow,
  originName,
  destinationName,
  origin,
  destination,
  columns,
  primary,
  secondary,
  onPress,
}: CurrentTripCardProps) {
  const canShowMap = Boolean(origin && destination) && (Platform.OS === 'web' || hasMapToken);

  return (
    <View style={styles.card}>
      <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel="Ouvrir le trajet">
        <View style={styles.mapBox}>
          {canShowMap ? (
            <RouteMap origin={origin ?? null} destination={destination ?? null} height={MAP_HEIGHT} />
          ) : (
            <RoutePlaceholder originName={originName} destinationName={destinationName} />
          )}
        </View>

        <View style={styles.body}>
          <AppText variant="xs" weight="bold" color={OCEAN.base} style={styles.eyebrow}>
            DÉTAILS DU TRAJET
          </AppText>
          <AppText variant="md" weight="bold" color={OCEAN.deep} numberOfLines={2}>
            {eyebrow} · {originName} à {destinationName}
          </AppText>

          <View style={styles.columns}>
            {columns.map((column) => (
              <View key={column.label} style={styles.column}>
                <AppText variant="xs" color="textMuted">
                  {column.label}
                </AppText>
                <AppText variant="sm" weight="bold" color={OCEAN.deep} numberOfLines={2}>
                  {column.value}
                </AppText>
              </View>
            ))}
          </View>
        </View>
      </Pressable>

      <View style={styles.actions}>
        <Pressable
          onPress={primary.onPress}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, styles.buttonPrimary, pressed && styles.pressed]}
        >
          <AppText variant="xs" weight="bold" color={OCEAN.onDark} style={styles.buttonText}>
            {primary.label.toUpperCase()}
          </AppText>
        </Pressable>
        <Pressable
          onPress={secondary.onPress}
          disabled={secondary.loading}
          accessibilityRole="button"
          style={({ pressed }) => [styles.button, styles.buttonGold, pressed && styles.pressed]}
        >
          {secondary.loading ? (
            <ActivityIndicator size="small" color={OCEAN.goldInk} />
          ) : (
            <AppText variant="xs" weight="bold" color={colors.onAccent} style={styles.buttonText}>
              {secondary.label.toUpperCase()}
            </AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: OCEAN.line,
    overflow: 'hidden',
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  mapBox: {
    height: MAP_HEIGHT,
    backgroundColor: OCEAN.mist,
    overflow: 'hidden',
  },
  body: {
    padding: spacing.md,
    gap: 4,
  },
  eyebrow: {
    letterSpacing: 1,
  },
  columns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: OCEAN.line,
  },
  column: {
    flex: 1,
    gap: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  button: {
    flex: 1,
    minHeight: 46,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: {
    backgroundColor: OCEAN.base,
  },
  buttonGold: {
    backgroundColor: OCEAN.gold,
  },
  buttonText: {
    letterSpacing: 0.5,
    textAlign: 'center',
  },

  placeholder: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    overflow: 'hidden',
  },
  placeholderCircle: {
    position: 'absolute',
    top: -50,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(30,155,215,0.14)',
  },
  placeholderRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  placeholderPoint: {
    alignItems: 'center',
    gap: 6,
    maxWidth: 96,
  },
  placeholderBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderCity: {
    textAlign: 'center',
  },
  placeholderDashes: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  placeholderDash: {
    width: 8,
    height: 3,
    borderRadius: 2,
    backgroundColor: OCEAN.base,
    opacity: 0.55,
  },
});
