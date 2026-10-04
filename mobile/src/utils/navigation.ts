// mobile/src/utils/navigation.ts
//
// Navigation de fin de parcours. Après une création (trajet, réservation, envoi), un paiement ou l'acceptation d'un envoi, la page
// affichée se trouve au bout d'une pile d'écrans (recherche → résultats → détail → réservation → paiement…). La flèche « Retour »
// n'en retire qu'un à la fois ; la croix « Fermer » (voir OceanScreenHeader, `onClose`) les retire tous et revient à l'accueil.
import { router } from 'expo-router';

export type HomeRoute = '/(customer)/(tabs)/home' | '/(driver)/(tabs)/home';

/** Ferme tout ce qui s'est empilé depuis l'accueil, puis affiche l'accueil de l'espace concerné. */
export function closeToHome(home: HomeRoute): void {
  // Revient d'abord au premier écran de la pile (les onglets), puis place l'onglet « Accueil » : sans cela, on retomberait sur
  // l'onglet qui était ouvert avant le parcours.
  if (router.canDismiss()) router.dismissAll();
  router.replace(home);
}

/**
 * Valeur du paramètre `created` passé à un écran de détail affiché juste après une création : il y affiche la croix « Fermer ».
 * Un écran ouvert depuis une liste ne reçoit pas ce paramètre et garde sa flèche « Retour ».
 */
export const FLOW_DONE_PARAM = { created: '1' } as const;
