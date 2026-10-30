// mobile/src/services/storage/biometricStorage.ts
// [30/10/2026] v1 — Secret de la connexion par empreinte, gardé dans le coffre sécurisé du téléphone (Keychain iOS / Keystore Android).
//
// Ce n'est ni le mot de passe ni un jeton de session : c'est un secret aléatoire propre à CE téléphone, que l'API renouvelle à chaque connexion
// et qu'elle sait révoquer. Il reste dans le coffre à la déconnexion (c'est tout l'intérêt : se reconnecter d'un geste) et il n'est lu
// qu'APRÈS la vérification de l'empreinte par le système. Sur le web, rien n'est jamais stocké.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Space } from '@/types/roles.types';

const KEY = 'auth.biometric';
const DECLINED_KEY = 'biometricOfferDeclined';

export interface BiometricRecord {
  credentialId: string;
  /** Secret en cours ; remplacé par celui que renvoie l'API à chaque connexion. */
  token: string;
  userId: string;
  /** Dernier espace ouvert : c'est celui qu'on rouvre après une connexion par empreinte. */
  space: Space;
  /** Prénom, pour « Bonjour Fatoumata » sur l'écran de connexion. */
  name: string | null;
}

const isNative = Platform.OS !== 'web';

function isRecord(value: unknown): value is BiometricRecord {
  const record = value as Partial<BiometricRecord> | null;
  return Boolean(record && typeof record.credentialId === 'string' && typeof record.token === 'string' && typeof record.userId === 'string');
}

export const biometricStorage = {
  async get(): Promise<BiometricRecord | null> {
    if (!isNative) return null;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? { ...parsed, space: parsed.space === 'DRIVER' ? 'DRIVER' : 'CUSTOMER', name: parsed.name ?? null } : null;
    } catch {
      return null;
    }
  },

  async set(record: BiometricRecord): Promise<void> {
    if (!isNative) return;
    await SecureStore.setItemAsync(KEY, JSON.stringify(record), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  },

  async clear(): Promise<void> {
    if (!isNative) return;
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      // rien à supprimer
    }
  },

  /** La personne a répondu « Pas maintenant » à la proposition faite après la connexion : on ne la lui refait pas. */
  async wasOfferDeclined(): Promise<boolean> {
    try {
      return (await AsyncStorage.getItem(DECLINED_KEY)) === '1';
    } catch {
      return false;
    }
  },

  async markOfferDeclined(): Promise<void> {
    try {
      await AsyncStorage.setItem(DECLINED_KEY, '1');
    } catch {
      // pas grave : la proposition pourra être refaite
    }
  },
};
