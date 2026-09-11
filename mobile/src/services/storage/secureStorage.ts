// mobile/src/services/storage/secureStorage.ts
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Les jetons ne transitent jamais par AsyncStorage (non chiffré) —
 * toujours expo-secure-store (Keychain iOS / Keystore Android) sur
 * mobile natif. Un seul point d'accès pour que ce choix ne se
 * re-décide pas ailleurs par erreur.
 *
 * Sur web, expo-secure-store n'a AUCUNE implémentation fonctionnelle
 * (module natif vide côté web — vérifié dans node_modules, pas supposé)
 * : chaque appel y échouerait silencieusement. Seul recours pour un
 * navigateur : `localStorage`, moins sûr (accessible à tout script de
 * la page, donc vulnérable en cas de faille XSS) mais c'est le
 * compromis standard des apps Expo qui supportent aussi le web — jamais
 * un vrai coffre-fort côté navigateur de toute façon. À garder en tête
 * si une vraie surface d'attaque XSS existe côté web un jour.
 */
const KEYS = {
  accessToken: 'auth.accessToken',
  refreshToken: 'auth.refreshToken',
} as const;

const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return window.localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(key);
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
    await Promise.all([setItem(KEYS.accessToken, accessToken), setItem(KEYS.refreshToken, refreshToken)]);
  },
  async clearTokens(): Promise<void> {
    await Promise.all([deleteItem(KEYS.accessToken), deleteItem(KEYS.refreshToken)]);
  },
};
