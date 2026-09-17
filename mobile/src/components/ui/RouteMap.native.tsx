// mobile/src/components/ui/RouteMap.native.tsx
//
// Implémentation native — miroir de RouteMap.web.tsx mais avec le SDK
// natif @rnmapbox/maps plutôt que mapbox-gl (qui ne tourne qu'en DOM/web).
// Même interface (RouteMapProps) que la version web, pour que les deux
// fichiers restent interchangeables pour tout appelant.

import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Mapbox, { Camera, LineLayer, MapView, PointAnnotation, ShapeSource } from '@rnmapbox/maps';
import { colors, radius } from '@/theme';
import { AppText } from './AppText';

export interface RouteMapPoint {
  latitude: number;
  longitude: number;
  label: string;
}

export interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

export interface RouteMapProps {
  origin: RouteMapPoint | null;
  destination: RouteMapPoint | null;
  onRouteInfo?: (info: RouteInfo | null) => void;
  height?: number;
}

const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
if (token) {
  Mapbox.setAccessToken(token);
}

export function RouteMap({ origin, destination, onRouteInfo, height = 320 }: RouteMapProps) {
  const cameraRef = useRef<Camera>(null);
  const [routeGeoJson, setRouteGeoJson] = useState<GeoJSON.Feature<GeoJSON.LineString> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    token ? null : 'Carte indisponible : EXPO_PUBLIC_MAPBOX_TOKEN manquant dans mobile/.env',
  );

  useEffect(() => {
    if (!token || !origin || !destination) {
      setRouteGeoJson(null);
      onRouteInfo?.(null);
      return;
    }

    let cancelled = false;

    async function fetchRoute() {
      try {
        const coords = `${origin!.longitude},${origin!.latitude};${destination!.longitude},${destination!.latitude}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${token}`;
        const response = await fetch(url);
        const data = await response.json();
        if (cancelled) return;

        const route = data?.routes?.[0];
        if (!route) {
          setErrorMessage('Aucun itinéraire routier trouvé entre ces deux points.');
          onRouteInfo?.(null);
          return;
        }

        setErrorMessage(null);
        setRouteGeoJson({ type: 'Feature', properties: {}, geometry: route.geometry });
        onRouteInfo?.({
          distanceKm: Math.round(route.distance / 100) / 10,
          durationMin: Math.round(route.duration / 60),
        });

        const lngs = route.geometry.coordinates.map((c: [number, number]) => c[0]);
        const lats = route.geometry.coordinates.map((c: [number, number]) => c[1]);
        cameraRef.current?.fitBounds(
          [Math.max(...lngs), Math.max(...lats)],
          [Math.min(...lngs), Math.min(...lats)],
          48,
          600,
        );
      } catch {
        if (!cancelled) {
          setErrorMessage("Impossible de calculer l'itinéraire pour le moment.");
          onRouteInfo?.(null);
        }
      }
    }

    fetchRoute();
    return () => {
      cancelled = true;
    };
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude]);

  return (
    <View style={[styles.container, { height }]}>
      <MapView style={styles.mapSurface} scaleBarEnabled={false} logoEnabled={false}>
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: origin ? [origin.longitude, origin.latitude] : [-13.6773, 9.6412],
            zoomLevel: 5,
          }}
        />

        {origin ? (
          <PointAnnotation id="origin" coordinate={[origin.longitude, origin.latitude]}>
            <View style={[styles.marker, { backgroundColor: colors.primary }]} />
          </PointAnnotation>
        ) : null}

        {destination ? (
          <PointAnnotation id="destination" coordinate={[destination.longitude, destination.latitude]}>
            <View style={[styles.marker, { backgroundColor: colors.accentDark }]} />
          </PointAnnotation>
        ) : null}

        {routeGeoJson ? (
          <ShapeSource id="route" shape={routeGeoJson}>
            <LineLayer
              id="route-line"
              style={{ lineColor: colors.primary, lineWidth: 4, lineJoin: 'round', lineCap: 'round' }}
            />
          </ShapeSource>
        ) : null}
      </MapView>

      {errorMessage ? (
        <View style={styles.errorBanner}>
          <AppText variant="xs" color="textSecondary">
            {errorMessage}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surfaceMuted,
  },
  mapSurface: {
    flex: 1,
  },
  marker: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#fff',
  },
  errorBanner: {
    position: 'absolute',
    left: 8,
    right: 8,
    bottom: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: 8,
  },
});