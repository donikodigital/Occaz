// backend/src/integrations/geocoding/mapbox-geocoding.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import type { GeocodingProvider, GeocodingSuggestion } from './geocoding-provider.interface';

/** Sous-ensemble de la réponse Mapbox Geocoding v6 réellement utilisé — voir https://docs.mapbox.com/api/search/geocoding/. */
interface MapboxFeatureCollection {
  features: Array<{
    geometry: { coordinates: [number, number] }; // [longitude, latitude]
    properties: {
      name: string;
      full_address?: string;
      place_formatted?: string;
    };
  }>;
}

/**
 * Géocodage "temporaire" (comportement par défaut de l'API, pas de
 * paramètre `permanent=true`) — conforme aux conditions d'utilisation
 * de Mapbox : on ne stocke jamais la réponse brute, seulement le
 * résultat choisi par l'utilisateur, converti en Location via la
 * route existante POST /locations (voir locations.controller.ts,
 * champ geocodeTrust déjà prévu pour ça).
 */
@Injectable()
export class MapboxGeocodingProvider implements GeocodingProvider {
  private readonly logger = new Logger(MapboxGeocodingProvider.name);
  private readonly baseUrl = 'https://api.mapbox.com/search/geocode/v6';

  private getAccessToken(): string {
    const token = process.env.MAPBOX_ACCESS_TOKEN;
    if (!token) {
      throw new Error(
        "Variable d'environnement MAPBOX_ACCESS_TOKEN manquante — voir .env.example (section géocodage).",
      );
    }
    return token;
  }

  async search(query: string, countryCode?: string): Promise<GeocodingSuggestion[]> {
    const params = new URLSearchParams({
      q: query,
      access_token: this.getAccessToken(),
      autocomplete: 'true',
      limit: '5',
      language: 'fr',
    });
    if (countryCode) params.set('country', countryCode.toLowerCase());

    const data = await this.request(`${this.baseUrl}/forward?${params.toString()}`);
    return data.features.map(toSuggestion);
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<GeocodingSuggestion | null> {
    const params = new URLSearchParams({
      longitude: String(longitude),
      latitude: String(latitude),
      access_token: this.getAccessToken(),
      limit: '1',
      language: 'fr',
    });

    const data = await this.request(`${this.baseUrl}/reverse?${params.toString()}`);
    const [first] = data.features;
    return first ? toSuggestion(first) : null;
  }

  private async request(url: string): Promise<MapboxFeatureCollection> {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (error) {
      this.logger.error(`Échec de connexion à Mapbox : ${(error as Error).message}`);
      throw new Error('Le service de géocodage est momentanément indisponible.');
    }

    if (!response.ok) {
      this.logger.error(`Mapbox a répondu ${response.status} pour ${url.split('?')[0]}`);
      throw new Error('Le service de géocodage est momentanément indisponible.');
    }

    return response.json() as Promise<MapboxFeatureCollection>;
  }
}

function toSuggestion(feature: MapboxFeatureCollection['features'][number]): GeocodingSuggestion {
  const [longitude, latitude] = feature.geometry.coordinates;
  return {
    label: feature.properties.name,
    formattedAddress: feature.properties.full_address ?? feature.properties.place_formatted ?? feature.properties.name,
    latitude,
    longitude,
  };
}
