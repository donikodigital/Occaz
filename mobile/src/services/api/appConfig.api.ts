// mobile/src/services/api/appConfig.api.ts
// [19/10/2026] v1 — Réglages publics de l'application (version minimale exigée, fonctions dépendant d'un SMS). Route publique : pas de jeton.
import { api } from './client';

export interface AppConfig {
  /** Version minimale exigée (« 1.4.0 ») ; « 0.0.0 » = aucune exigence. */
  minVersion: string;
  updateUrlAndroid: string | null;
  updateUrlIos: string | null;
  features: {
    /** Les proches reçoivent un SMS lors d'une alerte SOS. */
    sosSms: boolean;
    /** Le changement de numéro par code SMS est ouvert. */
    phoneChange: boolean;
  };
}

export const appConfigApi = {
  get: () => api.get<AppConfig>('/app-config', { auth: false }),
};
