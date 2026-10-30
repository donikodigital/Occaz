// mobile/src/services/biometric.ts
// [30/10/2026] v1 — Biométrie du téléphone (empreinte digitale, visage) via expo-local-authentication.
//
// L'empreinte est vérifiée par le SYSTÈME (Android / iOS) : l'application ne la voit jamais, elle reçoit seulement « réussi » ou la raison de
// l'échec. Sur le web, la biométrie n'est pas proposée (aucun coffre-fort sécurisé de toute façon, voir secureStorage.ts).
import { Platform } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { translate } from '@/i18n';

export type BiometricKind = 'fingerprint' | 'face' | 'iris' | 'generic';

export interface BiometricCapability {
  /** Le téléphone a un capteur ET au moins une empreinte / un visage enregistré : on peut proposer la fonction. */
  available: boolean;
  kind: BiometricKind;
  /** Pourquoi la fonction n'est pas proposée (affiché dans les réglages). */
  reason?: 'unsupported' | 'not_enrolled';
}

export type BiometricOutcome = 'success' | 'cancelled' | 'lockout' | 'failed';

const NONE: BiometricCapability = { available: false, kind: 'generic', reason: 'unsupported' };

export async function getBiometricCapability(): Promise<BiometricCapability> {
  if (Platform.OS === 'web') return NONE;
  try {
    if (!(await LocalAuthentication.hasHardwareAsync())) return NONE;
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const kind: BiometricKind = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
      ? 'fingerprint'
      : types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
        ? 'face'
        : types.includes(LocalAuthentication.AuthenticationType.IRIS)
          ? 'iris'
          : 'generic';
    if (!(await LocalAuthentication.isEnrolledAsync())) return { available: false, kind, reason: 'not_enrolled' };
    return { available: true, kind };
  } catch {
    return NONE;
  }
}

/** « l'empreinte digitale », « la reconnaissance faciale »… pour les phrases ; neutre quand le type est inconnu. */
export function biometricName(kind: BiometricKind): string {
  if (kind === 'fingerprint') return translate('l’empreinte digitale');
  if (kind === 'face') return translate('la reconnaissance faciale');
  return translate('la biométrie');
}

/** Ouvre la fenêtre système de vérification (empreinte / visage). Le code du téléphone n'est pas accepté en remplacement. */
export async function confirmWithBiometrics(promptMessage: string): Promise<BiometricOutcome> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: translate('Annuler'),
      disableDeviceFallback: true,
    });
    if (result.success) return 'success';
    if (result.error === 'user_cancel' || result.error === 'system_cancel' || result.error === 'app_cancel' || result.error === 'user_fallback') {
      return 'cancelled';
    }
    if (result.error === 'lockout') return 'lockout';
    return 'failed';
  } catch {
    return 'failed';
  }
}
