// mobile/src/components/ui/RouteMap.web.tsx
//
// Carte avec tracé d'itinéraire réel — implémentation web uniquement.
// RouteMap.native.tsx (même dossier) est chargé sur iOS/Android à la
// place de ce fichier, automatiquement, via la résolution de fichiers
// par plateforme de Metro. Choix volontaire : la mise en page desktop
// qui contient cette carte ne s'affiche jamais sur mobile natif (voir
// useResponsive.ts), donc pas de dépendance carto native pour l'instant.
//
// Dépendance : `npm install mapbox-gl` puis `npm install -D @types/mapbox-gl`.
//
// Token : EXPO_PUBLIC_MAPBOX_TOKEN dans mobile/.env — un token PUBLIC
// (préfixe "pk.") depuis ton compte Mapbox, distinct du MAPBOX_ACCESS_TOKEN
// secret déjà utilisé côté backend pour le géocodage. À restreindre par
// domaine (URL restrictions, sur mapbox.com) avant la mise en production.
//
// Le tracé vient de l'API Directions de Mapbox, appelée directement
// depuis ce composant avec ce même token public — usage standard
// documenté par Mapbox, aucun endpoint backend nécessaire pour cette
// première version.

import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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

const CONAKRY_CENTER: [number, number] = [-13.6773, 9.6412];
const MAPBOX_CSS_HREF = 'https://api.mapbox.com/mapbox-gl-js/v3.9.0/mapbox-gl.css';
const MAPBOX_CSS_ID = 'mapbox-gl-css';

function ensureMapboxCss() {
  if (document.getElementById(MAPBOX_CSS_ID)) return;
  const link = document.createElement('link');
  link.id = MAPBOX_CSS_ID;
  link.rel = 'stylesheet';
  link.href = MAPBOX_CSS_HREF;
  document.head.appendChild(link);
}

/** mapbox-gl expose son export par défaut différemment selon la version/le bundler — on gère les deux formes. */
function resolveMapboxGl(mod: unknown): any {
  return (mod as any)?.default ?? mod;
}

export function RouteMap({ origin, destination, onRouteInfo, height = 320 }: RouteMapProps) {
  const containerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

  // Initialisation de la carte — une seule fois.
  useEffect(() => {
    if (!token) {
      setErrorMessage('Carte indisponible : EXPO_PUBLIC_MAPBOX_TOKEN manquant dans mobile/.env');
      return;
    }
    if (!containerRef.current || mapRef.current) return;

    ensureMapboxCss();
    let cancelled = false;

    import('mapbox-gl')
      .then((mod) => {
        if (cancelled || !containerRef.current) return;
        const mapboxgl = resolveMapboxGl(mod);
        mapboxgl.accessToken = token;

        mapRef.current = new mapboxgl.Map({
          container: containerRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: CONAKRY_CENTER,
          zoom: 11,
        });
        mapRef.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
        mapRef.current.once('load', () => {
          if (!cancelled) setMapReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) {
          setErrorMessage("Impossible de charger la carte — vérifie que 'mapbox-gl' est installé.");
        }
      });

    return () => {
      cancelled = true;
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // volontairement limité au montage : le token ne change pas en cours
    // de session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marqueurs + tracé — à chaque changement d'origine/destination, une
  // fois la carte prête.
  useEffect(() => {
    if (!mapRef.current || !token || !mapReady) return;

    let cancelled = false;
    const map = mapRef.current;

    async function updateRoute() {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      if (map.getLayer('route-line')) map.removeLayer('route-line');
      if (map.getSource('route')) map.removeSource('route');

      const mapboxgl = resolveMapboxGl(await import('mapbox-gl'));

      if (origin) {
        markersRef.current.push(
          new mapboxgl.Marker({ color: colors.primary }).setLngLat([origin.longitude, origin.latitude]).addTo(map),
        );
      }
      if (destination) {
        markersRef.current.push(
          new mapboxgl.Marker({ color: colors.accentDark })
            .setLngLat([destination.longitude, destination.latitude])
            .addTo(map),
        );
      }

      if (!origin || !destination) {
        onRouteInfo?.(null);
        if (origin) map.flyTo({ center: [origin.longitude, origin.latitude], zoom: 12 });
        return;
      }

      try {
        const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
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

        map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: route.geometry } });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: { 'line-color': colors.primary, 'line-width': 4 },
        });

        const bounds = new mapboxgl.LngLatBounds();
        route.geometry.coordinates.forEach((c: [number, number]) => bounds.extend(c));
        map.fitBounds(bounds, { padding: 48, duration: 600 });

        onRouteInfo?.({
          distanceKm: Math.round(route.distance / 100) / 10,
          durationMin: Math.round(route.duration / 60),
        });
      } catch {
        if (!cancelled) {
          setErrorMessage("Impossible de calculer l'itinéraire pour le moment.");
          onRouteInfo?.(null);
        }
      }
    }

    updateRoute();
    return () => {
      cancelled = true;
    };
  }, [origin?.latitude, origin?.longitude, destination?.latitude, destination?.longitude, mapReady, token]);

  return (
    <View style={[styles.container, { height }]}>
      <View ref={containerRef} style={styles.mapSurface} />
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
    width: '100%',
    height: '100%',
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