// web-admin/src/services/storage/tokenStorage.ts
// [19/10/2026] v2 — Les jetons de connexion ne sont PLUS stockés dans le navigateur : ils vivent dans des cookies HttpOnly posés par le relais
// serveur /api/bff (voir app/api/bff/[...path]/route.ts). Ce fichier ne garde qu'un nettoyage : les sessions ouvertes avant cette
// version ont laissé deux jetons dans le localStorage, que l'on efface au démarrage pour qu'ils ne traînent pas là.
const LEGACY_KEYS = ['auth.accessToken', 'auth.refreshToken'] as const;

export const tokenStorage = {
  /** Efface les anciens jetons du localStorage (inoffensif s'il n'y en a pas). */
  clearLegacyTokens(): void {
    try {
      for (const key of LEGACY_KEYS) window.localStorage.removeItem(key);
    } catch {
      // stockage indisponible (navigation privée stricte) : rien à nettoyer
    }
  },
};
