// mobile/src/services/storage/secureStorage.ts
import * as SecureStore from 'expo-secure-store';

/**
 * Les jetons ne transitent jamais par AsyncStorage (non chiffré) —
 * toujours expo-secure-store (Keychain iOS / Keystore Android). Un seul
 * point d'accès pour que ce choix ne se re-décide pas ailleurs par erreur.
 */
const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
} as const;

export const secureStorage = {
  async getAccessToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.accessToken);
  },
  async getRefreshToken(): Promise<string | null> {
    return SecureStore.getItemAsync(KEYS.refreshToken);
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.accessToken, accessToken),
      SecureStore.setItemAsync(KEYS.refreshToken, refreshToken),
    ]);
  },
  async clearTokens(): Promise<void> {
    await Promise.all([
      SecureStore.deleteItemAsync(KEYS.accessToken),
      SecureStore.deleteItemAsync(KEYS.refreshToken),
    ]);
  },
};
