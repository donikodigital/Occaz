// mobile/src/hooks/useProfileStepBack.ts
// [19/10/2026] v1 — Retour depuis l'écran « Complétez votre profil » (passager ou conducteur).
// L'écran est ouvert par un « replace » (bascule d'espace) ou par une redirection : l'historique ne contient donc pas toujours l'écran
// précédent. Le retour suit cet ordre :
// 1. le compte possède aussi l'autre espace (passager ↔ conducteur) : on y retourne, ce qui remet aussi le bon espace actif
//    (un simple « back » rouvrirait l'accueil, qui renverrait aussitôt ici) ;
// 2. sinon, s'il existe un écran précédent : on y revient ;
// 3. sinon (première inscription, rien où retourner) : pas de bouton, la fonction renvoie null.
import { router } from 'expo-router';
import { useAccountRoles, useSwitchSpace } from '@/hooks/useAccountRoles';
import type { Space } from '@/types/roles.types';

/** `space` : l'espace dont on complète le profil. Renvoie la fonction de retour, ou null s'il n'y a nulle part où retourner. */
export function useProfileStepBack(space: Space): (() => void) | null {
  const { data: roles } = useAccountRoles();
  const switchTo = useSwitchSpace();

  const otherSpace: Space = space === 'DRIVER' ? 'CUSTOMER' : 'DRIVER';
  const hasOtherSpace = space === 'DRIVER' ? Boolean(roles?.customer) : Boolean(roles?.driver);

  if (hasOtherSpace) return () => switchTo(otherSpace);
  if (router.canGoBack()) return () => router.back();
  return null;
}
