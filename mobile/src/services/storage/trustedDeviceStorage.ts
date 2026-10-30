// mobile/src/services/storage/trustedDeviceStorage.ts
// [30/10/2026] v1 — Secret du « téléphone de confiance », gardé dans le coffre sécurisé du téléphone (Keychain iOS / Keystore Android).
//
// Ce n'est ni le mot de passe ni un jeton de session : c'est un secret aléatoire propre à CE téléphone, remis par l'API quand la personne
// accepte de l'enregistrer. Il reste dans le coffre à la déconnexion (c'est ce qui permet de se reconnecter sans code) ; l'API n'en garde que
// le hash et sait le révoquer. Sur le web, rien n'est jamais stocké : un navigateur n'est jamais un téléphone de confiance.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'auth.trustedDevice';

export interface TrustedDeviceRecord {
  id: string;
  secret: string;
  /** Compte pour lequel ce téléphone a été enregistré. */
  userId: string;
}

const isNative = Platform.OS !== 'web';

function isRecord(value: unknown): value is TrustedDeviceRecord {
  const record = value as Partial<TrustedDeviceRecord> | null;
  return Boolean(record && typeof record.id === 'string' && typeof record.secret === 'string' && typeof record.userId === 'string');
}

export const trustedDeviceStorage = {
  async get(): Promise<TrustedDeviceRecord | null> {
    if (!isNative) return null;
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  },

  async set(record: TrustedDeviceRecord): Promise<void> {
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
};
