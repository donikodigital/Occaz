// mobile/src/hooks/useLocationPicker.ts
//
// Parcours de saisie d'adresse en deux étapes, partagé par
// LocationPickerScreen (mobile) et LocationAutocompleteField (desktop) :
//
//   1. « search »  — l'utilisateur tape un lieu et touche un résultat :
//        - adresse déjà mémorisée -> choisie immédiatement ;
//        - suggestion Mapbox      -> on passe à l'étape 2, la ville est
//                                    détectée automatiquement en arrière-plan ;
//        - saisie manuelle        -> étape 2, la ville est à choisir.
//   2. « confirm » — l'utilisateur vérifie le nom du lieu et la ville
//      (modifiable), puis valide. L'adresse est créée et mémorisée côté
//      serveur pour ses prochaines recherches.

import { useCallback, useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/services/api/ApiError';
import { locationsApi } from '@/services/api/locations.api';
import { useCountries } from '@/hooks/useCities';
import { SAVED_LOCATIONS_QUERY_KEY } from '@/hooks/useSavedLocations';
import type { City } from '@/types/geography.types';
import type { GeocodingSuggestion } from '@/types/geocoding.types';
import type { SavedLocation } from '@/types/location-picker.types';
import type { TripLocation } from '@/types/trips.types';

export type CityStatus = 'detecting' | 'detected' | 'unresolved';

interface LocationDraft {
  label: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * Codes pays envoyés à la recherche Mapbox. Sans eux, la recherche
 * remonte des résultats du monde entier (Belgique, France…) pour un même
 * libellé. Par défaut : les pays actifs de la plateforme, séparés par des
 * virgules (Mapbox accepte plusieurs codes).
 */
export function useSearchCountryCodes(explicitCountryCode?: string): string | undefined {
  const { data: countries } = useCountries();

  return useMemo(() => {
    if (explicitCountryCode) return explicitCountryCode;
    const codes = (countries ?? []).filter((country) => country.isActive).map((country) => country.isoCode.toLowerCase());
    return codes.length > 0 ? codes.join(',') : undefined;
  }, [countries, explicitCountryCode]);
}

export function useLocationPicker(onPicked: (location: TripLocation) => void) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<LocationDraft | null>(null);
  const [city, setCity] = useState<City | null>(null);
  const [cityStatus, setCityStatus] = useState<CityStatus>('unresolved');
  const [isChangingCity, setChangingCity] = useState(false);
  const [isSubmitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  // Numéro de la détection en cours : une réponse tardive d'une détection
  // abandonnée (retour arrière, autre lieu, ville choisie à la main) est ignorée.
  const detectionId = useRef(0);

  const refreshSaved = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: SAVED_LOCATIONS_QUERY_KEY });
  }, [queryClient]);

  const reset = useCallback(() => {
    detectionId.current += 1;
    setDraft(null);
    setCity(null);
    setCityStatus('unresolved');
    setChangingCity(false);
    setErrorMessage(undefined);
  }, []);

  /** Adresse déjà mémorisée : aucune étape de confirmation, elle a déjà été validée. */
  const pickSaved = useCallback(
    (saved: SavedLocation) => {
      locationsApi
        .markUsed(saved.id)
        .then(refreshSaved)
        .catch(() => undefined);
      onPicked({
        id: saved.id,
        label: saved.label,
        formattedAddress: saved.formattedAddress,
        latitude: saved.latitude,
        longitude: saved.longitude,
        cityId: saved.cityId,
      });
    },
    [onPicked, refreshSaved],
  );

  const pickSuggestion = useCallback((suggestion: GeocodingSuggestion) => {
    const id = detectionId.current + 1;
    detectionId.current = id;

    setDraft({
      label: suggestion.label,
      formattedAddress: suggestion.formattedAddress,
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setCity(null);
    setChangingCity(false);
    setErrorMessage(undefined);
    setCityStatus('detecting');

    locationsApi
      .resolveCity({
        latitude: suggestion.latitude,
        longitude: suggestion.longitude,
        address: [suggestion.label, suggestion.formattedAddress].filter(Boolean).join(', '),
      })
      .then(({ city: detected }) => {
        if (detectionId.current !== id) return;
        if (detected) {
          setCity(detected);
          setCityStatus('detected');
        } else {
          setCityStatus('unresolved');
        }
      })
      .catch(() => {
        if (detectionId.current === id) setCityStatus('unresolved');
      });
  }, []);

  /** Adresse introuvable : l'utilisateur garde ce qu'il a tapé, sans position GPS, et choisit la ville. */
  const startManual = useCallback((label: string) => {
    detectionId.current += 1;
    setDraft({ label });
    setCity(null);
    setChangingCity(false);
    setErrorMessage(undefined);
    setCityStatus('unresolved');
  }, []);

  const backToSearch = useCallback(() => reset(), [reset]);

  const setLabel = useCallback((label: string) => {
    setDraft((current) => (current ? { ...current, label } : current));
  }, []);

  const selectCity = useCallback((selected: City) => {
    detectionId.current += 1;
    setCity(selected);
    setCityStatus('detected');
    setChangingCity(false);
    setErrorMessage(undefined);
  }, []);

  /** La détection tarde ou se trompe : l'utilisateur choisit lui-même. */
  const chooseCityManually = useCallback(() => {
    detectionId.current += 1;
    setCityStatus('unresolved');
  }, []);

  const toggleChangeCity = useCallback(() => setChangingCity((current) => !current), []);

  const confirm = useCallback(async () => {
    if (!draft) return;
    setErrorMessage(undefined);

    if (!city) {
      setErrorMessage('Choisissez la ville de cette adresse.');
      return;
    }
    if (draft.label.trim().length < 3) {
      setErrorMessage('Indiquez le nom du lieu (quartier, repère…).');
      return;
    }

    setSubmitting(true);
    try {
      const hasPoint = draft.latitude !== undefined && draft.longitude !== undefined;
      const location = await locationsApi.create({
        label: draft.label.trim(),
        cityId: city.id,
        ...(hasPoint
          ? {
              formattedAddress: draft.formattedAddress,
              latitude: draft.latitude,
              longitude: draft.longitude,
              geocodeTrust: 'EXACT' as const,
            }
          : { geocodeTrust: 'MANUAL' as const }),
      });
      // onPicked (qui déclenche router.back()) part en premier — comme dans
      // pickSaved. refreshSaved() invalide une requête et peut donc
      // provoquer un nouveau rendu du champ de recherche (resté monté,
      // juste masqué) ; le faire avant la navigation a déjà produit un
      // écran noir au retour sur Android, la transition et ce nouveau
      // rendu se chevauchant sur un écran encore techniquement monté.
      onPicked(location);
      reset();
      refreshSaved();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }, [draft, city, onPicked, refreshSaved, reset]);

  return {
    step: draft ? ('confirm' as const) : ('search' as const),
    draft,
    city,
    cityStatus,
    isChangingCity,
    isSubmitting,
    errorMessage,
    pickSaved,
    pickSuggestion,
    startManual,
    backToSearch,
    setLabel,
    selectCity,
    chooseCityManually,
    toggleChangeCity,
    confirm,
  };
}

export type LocationPickerController = ReturnType<typeof useLocationPicker>;