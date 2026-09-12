// web-admin/src/services/storage/tokenStorage.ts
/**
 * localStorage plutôt qu'un cookie httpOnly — plus simple pour un outil
 * interne à usage restreint (Support/SuperAdmin), cohérent avec le repli
 * web de l'app mobile (voir mobile/src/services/storage/secureStorage.ts,
 * qui documente le même compromis). `window` est toujours défini ici :
 * ce module n'est importé que par du code client ('use client').
 */
const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
} as const;

export const tokenStorage = {
  getAccessToken(): string | null {
    return window.localStorage.getItem(KEYS.accessToken);
  },
  getRefreshToken(): string | null {
    return window.localStorage.getItem(KEYS.refreshToken);
  },
  setTokens(accessToken: string, refreshToken: string): void {
    window.localStorage.setItem(KEYS.accessToken, accessToken);
    window.localStorage.setItem(KEYS.refreshToken, refreshToken);
  },
  clearTokens(): void {
    window.localStorage.removeItem(KEYS.accessToken);
    window.localStorage.removeItem(KEYS.refreshToken);
  },
};
