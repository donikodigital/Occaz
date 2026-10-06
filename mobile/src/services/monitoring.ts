// mobile/src/services/monitoring.ts
//
// Suivi des erreurs (Sentry) de l'application. Désactivé tant que EXPO_PUBLIC_SENTRY_DSN est absent : sans cette variable, l'app
// n'initialise rien, n'envoie rien et se comporte exactement comme avant. En développement (`__DEV__`) il est aussi désactivé, pour
// ne pas remplir le quota gratuit avec les erreurs de la phase de test (EXPO_PUBLIC_SENTRY_IN_DEV=true pour l'activer quand même).
//
// Ce qui est remonté : les plantages (JavaScript et natifs), les erreurs d'affichage (écran d'erreur d'Expo Router) et les rejets de
// promesses non gérés. Les erreurs ATTENDUES de l'API (code invalide, réservation complète…) sont affichées à l'utilisateur et ne
// sont pas des plantages : elles ne partent pas. Les pannes du serveur, elles, sont déjà vues par le suivi du backend.
import React from 'react';
import * as Sentry from '@sentry/react-native';
import { useAuthStore } from '@/stores/authStore';
import { scrubBreadcrumb, scrubEvent } from './monitoringScrub';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();

export const isMonitoringEnabled: boolean = Boolean(DSN) && (!__DEV__ || process.env.EXPO_PUBLIC_SENTRY_IN_DEV === 'true');

/** Part des sessions tracées (0 à 1). 0 par défaut : le traçage consomme aussi le quota du plan gratuit. */
function tracesSampleRate(): number {
  const value = Number(process.env.EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** À appeler une fois, au chargement de l'application (app/_layout.tsx), avant l'affichage du premier écran. */
export function initMonitoring(): void {
  if (!isMonitoringEnabled) return;

  Sentry.init({
    dsn: DSN,
    environment: process.env.EXPO_PUBLIC_SENTRY_ENVIRONMENT?.trim() || (__DEV__ ? 'development' : 'production'),
    tracesSampleRate: tracesSampleRate(),
    // Aucune donnée personnelle ajoutée d'office, aucune capture d'écran ni hiérarchie de vues jointe aux erreurs : l'écran peut
    // montrer un numéro de téléphone, une adresse, un code de prise en charge ou un solde.
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    enableUserInteractionTracing: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
  });

  // Seul l'identifiant du compte est associé aux erreurs (pas de nom, d'e-mail ni de téléphone) : il suffit au support pour
  // retrouver la personne concernée. Mis à jour à chaque connexion / déconnexion.
  const syncUser = (user: { id: string } | null) => Sentry.setUser(user ? { id: user.id } : null);
  syncUser(useAuthStore.getState().user);
  useAuthStore.subscribe((state) => syncUser(state.user));
}

/** Enrobe le composant racine (suivi des plantages et des erreurs d'affichage) ; tel quel si le suivi est désactivé. */
export function withMonitoring<P extends Record<string, unknown>>(RootComponent: React.ComponentType<P>): React.ComponentType<P> {
  return isMonitoringEnabled ? Sentry.wrap(RootComponent) : RootComponent;
}

/**
 * Enrobe l'écran d'erreur d'Expo Router pour que les erreurs d'affichage qu'il attrape soient remontées ; tel quel si désactivé.
 * (Le SDK Sentry 7.x n'a pas de `wrapExpoRouterErrorBoundary` : appeler cette fonction inexistante faisait planter l'app au
 * chargement dès que le suivi était actif — donc dans les builds EAS avec un DSN, jamais en développement.)
 */
export function withMonitoredErrorBoundary<P extends { error: Error; retry: () => Promise<void> }>(
  Boundary: React.ComponentType<P>,
): React.ComponentType<P> {
  if (!isMonitoringEnabled) return Boundary;

  function MonitoredErrorBoundary(props: P) {
    const { error } = props;
    React.useEffect(() => {
      Sentry.captureException(error);
    }, [error]);
    return React.createElement(Boundary, props);
  }
  return MonitoredErrorBoundary;
}