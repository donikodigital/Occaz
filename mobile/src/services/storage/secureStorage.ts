// mobile/src/services/storage/secureStorage.ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Sur natif (iOS/Android), les jetons ne transitent jamais par AsyncStorage
 * en clair — toujours expo-secure-store (Keychain iOS / Keystore Android).
 * `expo-secure-store` n'a pas d'implémentation web (c'est un wrapper natif :
 * `getValueWithKeyAsync` n'existe simplement pas dans le bundle web), donc
 * sur le web on retombe sur `localStorage`. C'est un choix de confort pour
 * le développement/preview web — ce n'est PAS un stockage chiffré côté
 * navigateur, à garder en tête si la cible web est un jour utilisée en
 * production avec des données sensibles.
 */
const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
} as const;

const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  }
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    if (typeof window !== 'undefined') window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const secureStorage = {
  async getAccessToken(): Promise<string | null> {
    return getItem(KEYS.accessToken);
  },
  async getRefreshToken(): Promise<string | null> {
    return getItem(KEYS.refreshToken);
  },
  async setTokens(accessToken: string, refreshToken: string): Promise<void> {
    await Promise.all([
      setItem(KEYS.accessToken, accessToken),
      setItem(KEYS.refreshToken, refreshToken),
    ]);
  },
  async clearTokens(): Promise<void> {
    await Promise.all([
      deleteItem(KEYS.accessToken),
      deleteItem(KEYS.refreshToken),
    ]);
  },
};