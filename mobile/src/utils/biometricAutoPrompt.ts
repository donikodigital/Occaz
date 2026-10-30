// mobile/src/utils/biometricAutoPrompt.ts
// [30/10/2026] v1 — Quand la vérification par empreinte se lance toute seule à l'ouverture de l'accueil.
// Au démarrage de l'app (ou quand la session a expiré) : oui, pour que la reconnexion tienne en un geste. Juste après « Se déconnecter » :
// non — la personne vient de choisir de sortir, on ne la reconnecte pas aussitôt. Une seule vérification automatique par ouverture de l'app.
let blocked = false;
let done = false;

/** À appeler à la déconnexion voulue par la personne. */
export function blockBiometricAutoPrompt(): void {
  blocked = true;
}

/** Vrai une seule fois, et seulement si la personne ne vient pas de se déconnecter. */
export function consumeBiometricAutoPrompt(): boolean {
  if (blocked || done) return false;
  done = true;
  return true;
}
