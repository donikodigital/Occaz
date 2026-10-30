// mobile/src/stores/biometricStore.ts
// [30/10/2026] v+ — téléphones de confiance : sur un téléphone inconnu, l'empreinte ne suffit pas, un code est demandé (reason 'verification').
// [30/10/2026] v1 — Connexion rapide par empreinte digitale : état, activation, connexion, désactivation.
//
// Parcours :
//  - Activation (profil, ou proposition juste après une connexion par mot de passe) : le mot de passe est redemandé à l'API, l'empreinte est
//    vérifiée par le téléphone, puis le secret reçu est rangé dans le coffre sécurisé (biometricStorage).
//  - Connexion (écran d'accueil / connexion) : l'empreinte libère le secret, l'API ouvre une session et en renvoie un nouveau (rotation).
//  - Se déconnecter ne désactive PAS l'empreinte : c'est ce qui permet de se reconnecter d'un geste. La désactivation est un choix explicite,
//    ou la conséquence d'un changement de mot de passe / d'un autre compte connecté sur ce téléphone / d'un secret refusé par l'API.
import { Alert, Platform } from 'react-native';
import { create } from 'zustand';
import { ApiError } from '@/services/api/ApiError';
import { biometricApi } from '@/services/api/biometric.api';
import { BiometricCapability, confirmWithBiometrics, getBiometricCapability, biometricName } from '@/services/biometric';
import { BiometricRecord, biometricStorage } from '@/services/storage/biometricStorage';
import { useActiveSpaceStore } from '@/stores/activeSpaceStore';
import { useAuthStore } from '@/stores/authStore';
import { useDeviceChallengeStore } from '@/stores/deviceChallengeStore';
import { useTrustedDeviceStore } from '@/stores/trustedDeviceStore';
import { needsDeviceVerification } from '@/types/auth.types';
import { spaceOfAccountType } from '@/utils/spaces';
import { translate } from '@/i18n';
import type { Space } from '@/types/roles.types';

const NO_CAPABILITY: BiometricCapability = { available: false, kind: 'generic', reason: 'unsupported' };
const platform = (): 'ios' | 'android' | undefined => (Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : undefined);

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'cancelled' | 'lockout' | 'failed' | 'rejected'; message?: string };

export type LoginResult =
  | { ok: true; space: Space }
  | { ok: false; reason: 'cancelled' | 'lockout' | 'failed' | 'expired' | 'network' | 'error' | 'verification'; message?: string };

interface BiometricState {
  isLoaded: boolean;
  capability: BiometricCapability;
  /** Présent = la connexion par empreinte est active sur ce téléphone. */
  record: BiometricRecord | null;
  load: () => Promise<void>;
  /** Active l'empreinte : `password` est le mot de passe actuel (6 chiffres). */
  enable: (password: string) => Promise<EnableResult>;
  /** Remet le secret à jour avec le nouveau mot de passe (après un changement de mot de passe, qui révoque l'ancien accès). */
  reenroll: (password: string) => Promise<void>;
  login: () => Promise<LoginResult>;
  /** Désactive ici et côté serveur (si connecté). */
  disable: () => Promise<void>;
  /** Efface seulement l'état local (compte supprimé, secret refusé…). */
  clear: () => Promise<void>;
  /** Vérifie auprès du serveur que cet accès existe encore (connecté) ; sinon l'état local est effacé. */
  reconcile: () => Promise<void>;
  /** Propose d'activer l'empreinte juste après une connexion par mot de passe réussie (une seule fois par téléphone). */
  offerAfterLogin: (password: string) => Promise<void>;
}

export const useBiometricStore = create<BiometricState>((set, get) => ({
  isLoaded: false,
  capability: NO_CAPABILITY,
  record: null,

  load: async () => {
    const [capability, record] = await Promise.all([getBiometricCapability(), biometricStorage.get()]);
    set({ capability, record, isLoaded: true });
  },

  enable: async (password) => {
    const capability = await getBiometricCapability();
    set({ capability });
    if (!capability.available) return { ok: false, reason: 'unavailable' };
    const user = useAuthStore.getState().user;
    if (!user) return { ok: false, reason: 'failed' };

    const outcome = await confirmWithBiometrics(
      translate('Confirmez avec {biometric} pour activer la connexion rapide.', { biometric: biometricName(capability.kind) }),
    );
    if (outcome !== 'success') return { ok: false, reason: outcome };

    try {
      const enrollment = await biometricApi.enable({ password, platform: platform() });
      const space = useActiveSpaceStore.getState().space ?? spaceOfAccountType(user.accountType);
      const record: BiometricRecord = { credentialId: enrollment.credentialId, token: enrollment.token, userId: user.id, space, name: user.firstName ?? null };
      await biometricStorage.set(record);
      set({ record });
      return { ok: true };
    } catch (error) {
      // Mot de passe refusé (400), compte verrouillé (429)… : le message du serveur est affiché tel quel.
      return { ok: false, reason: 'rejected', message: error instanceof ApiError ? error.message : undefined };
    }
  },

  reenroll: async (password) => {
    const previous = get().record;
    const user = useAuthStore.getState().user;
    if (!previous || !user) return;
    try {
      const enrollment = await biometricApi.enable({ password, platform: platform() });
      const record: BiometricRecord = { ...previous, credentialId: enrollment.credentialId, token: enrollment.token, userId: user.id };
      await biometricStorage.set(record);
      set({ record });
    } catch {
      await get().clear();
    }
  },

  login: async () => {
    const { record, capability } = get();
    if (!record) return { ok: false, reason: 'expired' };

    const outcome = await confirmWithBiometrics(
      translate('Connectez-vous avec {biometric}.', { biometric: biometricName(capability.kind) }),
    );
    if (outcome !== 'success') return { ok: false, reason: outcome };

    try {
      const result = await biometricApi.login({
        credentialId: record.credentialId,
        token: record.token,
        device: { platform: platform() },
        trustedDevice: useTrustedDeviceStore.getState().credential(),
      });
      // Téléphone inconnu d'un compte qui a des téléphones de confiance : le secret n'a pas changé, un code est demandé avant d'ouvrir la session.
      if (needsDeviceVerification(result)) {
        useDeviceChallengeStore.getState().start(result, { space: record.space, origin: 'biometric' });
        return { ok: false, reason: 'verification' };
      }
      // Le nouveau secret est rangé AVANT d'ouvrir la session : si l'app s'arrête entre les deux, on ne perd pas l'accès.
      const next: BiometricRecord = { ...record, token: result.biometricToken, userId: result.user.id, name: result.user.firstName ?? record.name };
      await biometricStorage.set(next);
      set({ record: next });
      await useAuthStore.getState().setSession(result);
      useActiveSpaceStore.getState().setSpace(next.space);
      await useTrustedDeviceStore.getState().noteLogin(result.trust);
      return { ok: true, space: next.space };
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.isNetworkError) return { ok: false, reason: 'network', message: error.message };
        if (error.isAuthError) {
          // Accès révoqué (mot de passe changé, déconnexion partout, secret copié…) ou compte suspendu : mot de passe à nouveau.
          const suspended = /suspendu/i.test(error.message);
          if (!suspended) await get().clear();
          return { ok: false, reason: 'expired', message: suspended ? error.message : undefined };
        }
        return { ok: false, reason: 'error', message: error.message };
      }
      return { ok: false, reason: 'error' };
    }
  },

  disable: async () => {
    const record = get().record;
    if (record && useAuthStore.getState().isAuthenticated) {
      await biometricApi.disable(record.credentialId).catch(() => undefined);
    }
    await get().clear();
  },

  clear: async () => {
    await biometricStorage.clear();
    set({ record: null });
  },

  reconcile: async () => {
    const record = get().record;
    if (!record || !useAuthStore.getState().isAuthenticated) return;
    try {
      const devices = await biometricApi.list();
      if (!devices.some((device) => device.id === record.credentialId)) await get().clear();
    } catch {
      // Réseau coupé : on garde l'état, la vérification se refera plus tard.
    }
  },

  offerAfterLogin: async (password) => {
    if (Platform.OS === 'web' || get().record) return;
    const capability = await getBiometricCapability();
    set({ capability });
    if (!capability.available || (await biometricStorage.wasOfferDeclined())) return;

    const accepted = await new Promise<boolean>((resolve) => {
      Alert.alert(
        translate('Connexion rapide'),
        translate('Voulez-vous vous reconnecter avec {biometric} la prochaine fois ? Vous pourrez le changer dans votre profil.', {
          biometric: biometricName(capability.kind),
        }),
        [
          { text: translate('Pas maintenant'), style: 'cancel', onPress: () => resolve(false) },
          { text: translate('Activer'), onPress: () => resolve(true) },
        ],
        { cancelable: false },
      );
    });
    if (!accepted) {
      await biometricStorage.markOfferDeclined();
      return;
    }
    // Échec sans gravité (empreinte annulée…) : la fonction reste activable depuis le profil.
    await get().enable(password);
  },
}));

// Un autre compte se connecte sur ce téléphone : l'accès par empreinte de l'ancien compte ne doit pas rester.
useAuthStore.subscribe((state, previous) => {
  const record = useBiometricStore.getState().record;
  if (record && state.user && state.user.id !== record.userId && state.user !== previous.user) {
    void useBiometricStore.getState().clear();
  }
});

// L'espace ouvert en dernier est celui qu'on rouvre à la prochaine connexion par empreinte.
useActiveSpaceStore.subscribe((state) => {
  const record = useBiometricStore.getState().record;
  if (record && state.space && state.space !== record.space) {
    const next = { ...record, space: state.space };
    useBiometricStore.setState({ record: next });
    void biometricStorage.set(next).catch(() => undefined);
  }
});
