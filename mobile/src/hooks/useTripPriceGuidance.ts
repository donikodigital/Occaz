// mobile/src/hooks/useTripPriceGuidance.ts
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { tripPricingApi } from '@/services/api/tripPricing.api';

/**
 * Mode de prix des trajets (manuel / semi-automatique / automatique) et prix conseillé pour ce trajet. Sans départ ni
 * arrivée, le serveur ne renvoie que le mode. La réponse précédente reste affichée pendant le recalcul : l'écran ne
 * clignote pas entre « champ de prix » et « prix fixé » à chaque changement d'adresse.
 */
export function useTripPriceGuidance(originLocationId: string | undefined, destinationLocationId: string | undefined) {
  return useQuery({
    queryKey: ['trip-pricing', 'guidance', originLocationId ?? null, destinationLocationId ?? null],
    queryFn: () => tripPricingApi.guidance({ originLocationId, destinationLocationId }),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}
