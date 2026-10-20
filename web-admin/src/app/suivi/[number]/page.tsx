// web-admin/src/app/suivi/[number]/page.tsx
//
// [20/10/2026] v1 — https://occaz.sarl/suivi/OCZ7F3A91C2B0 : page que le destinataire (ou un proche) ouvre depuis l'e-mail ou le SMS de suivi.
// C'est l'adresse construite par le serveur : TRACKING_BASE_URL + « /suivi/<numéro> » (backend/src/tracking/tracking-notifications.service.ts).
//
// Elle affiche ce que renvoie la route publique GET /tracking/public/:number : l'étape en cours, la frise des étapes, les villes de la route,
// où est le colis (position arrondie à ~5 km, jamais d'adresse exacte), le prénom du conducteur et l'historique. Aucun nom ni téléphone.
// Tant que le colis est en cours d'acheminement, la page se rafraîchit toute seule chaque minute.
'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  IconAlertTriangle,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconMapPin,
  IconPackage,
  IconRefresh,
  IconTruckDelivery,
  IconUser,
} from '@tabler/icons-react';
import { TrackingShell } from '@/components/tracking/TrackingShell';
import { trackingApi } from '@/services/api/tracking.api';
import { ApiError } from '@/services/api/ApiError';
import type { TrackingView } from '@/types/tracking.types';

const REFRESH_MS = 60_000;
const TIME_ZONE = 'Africa/Conakry';

const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
const timeOnly = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });

function formatDate(iso: string | null): string {
  return iso ? dateTime.format(new Date(iso)) : '';
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/10 ${className}`}>{children}</section>;
}

function CardTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
      {icon}
      {children}
    </h2>
  );
}

function StatusCard({ view }: { view: TrackingView }) {
  const tone =
    view.outcome === 'DELIVERED'
      ? { box: 'bg-success-light text-success-dark', icon: <IconCircleCheck size={26} aria-hidden /> }
      : view.outcome === 'CANCELLED' || view.outcome === 'INCIDENT'
        ? { box: 'bg-danger-light text-danger-dark', icon: <IconAlertTriangle size={26} aria-hidden /> }
        : { box: 'bg-primary-light text-primary', icon: <IconTruckDelivery size={26} aria-hidden /> };

  return (
    <Card>
      <p className="text-center text-xs font-bold uppercase tracking-wider text-text-muted">Colis {view.trackingNumberFormatted}</p>
      <div className="mt-3 flex items-start gap-3">
        <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.box}`}>{tone.icon}</span>
        <div className="min-w-0">
          <p className="text-lg font-bold leading-snug text-text-primary">{view.headline}</p>
          <p className="mt-1 text-sm text-text-secondary">
            {view.pickupCity} → {view.deliveryCity}
            {view.parcelsCount > 1 ? ` · ${view.parcelsCount} colis` : ''}
          </p>
        </div>
      </div>

      {view.outcome !== 'CANCELLED' ? (
        <ol className="mt-5 grid grid-cols-5 gap-1" aria-label="Étapes du colis">
          {view.progress.map((step) => (
            <li key={step.key} className="flex flex-col items-center gap-1.5 text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                  step.state === 'DONE'
                    ? 'bg-success text-on-primary'
                    : step.state === 'CURRENT'
                      ? 'bg-primary text-on-primary ring-4 ring-primary-accent'
                      : 'bg-surface-muted text-text-muted'
                }`}
              >
                {step.state === 'DONE' ? <IconCheck size={15} aria-hidden /> : null}
              </span>
              <span className={`text-[11px] leading-tight ${step.state === 'TODO' ? 'text-text-muted' : 'font-semibold text-text-primary'}`}>{step.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}

function LocationCard({ view }: { view: TrackingView }) {
  const { location } = view;
  if (view.outcome !== 'ACTIVE' || location.source === 'NONE') return null;
  const hasPoint = location.source === 'GPS' && location.latitude !== null && location.longitude !== null && !location.isStale;
  const mapUrl = hasPoint
    ? `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=11/${location.latitude}/${location.longitude}`
    : null;

  return (
    <Card>
      <CardTitle icon={<IconMapPin size={16} aria-hidden />}>Où est mon colis ?</CardTitle>
      <p className="mt-3 text-base font-semibold text-text-primary">{location.label}</p>
      {location.source === 'GPS' ? (
        <p className="mt-1 text-xs text-text-secondary">
          {location.isStale
            ? 'Le signal du véhicule est ancien : la position affichée peut ne plus être exacte.'
            : `Position approximative (à quelques km près), mise à jour à ${timeOnly.format(new Date(location.updatedAt ?? view.updatedAt))}.`}
        </p>
      ) : (
        <p className="mt-1 text-xs text-text-secondary">Déduit des villes traversées signalées par le conducteur.</p>
      )}
      {mapUrl ? (
        <a
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-light px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary-accent"
        >
          <IconMapPin size={18} aria-hidden />
          Voir la zone sur la carte
        </a>
      ) : null}
    </Card>
  );
}

function JourneyCard({ view }: { view: TrackingView }) {
  if (view.journey.length < 2) return null;
  return (
    <Card>
      <CardTitle icon={<IconTruckDelivery size={16} aria-hidden />}>La route</CardTitle>
      <ol className="mt-4 flex flex-col">
        {view.journey.map((point, index) => {
          const last = index === view.journey.length - 1;
          return (
            <li key={`${point.cityName}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${
                    point.state === 'DONE'
                      ? 'border-success bg-success'
                      : point.state === 'NEXT'
                        ? 'border-primary bg-surface ring-4 ring-primary-accent'
                        : 'border-border-strong bg-surface'
                  }`}
                />
                {!last ? <span className={`w-0.5 flex-1 ${point.state === 'DONE' ? 'bg-success' : 'bg-border'}`} /> : null}
              </div>
              <div className={`min-w-0 pb-4 ${last ? 'pb-0' : ''}`}>
                <p className={`text-sm ${point.state === 'TODO' ? 'text-text-muted' : 'font-semibold text-text-primary'}`}>{point.cityName}</p>
                <p className="text-xs text-text-secondary">
                  {point.kind === 'PICKUP' ? 'Départ' : point.kind === 'DELIVERY' ? 'Arrivée' : 'Étape'}
                  {point.at ? ` · ${formatDate(point.at)}` : point.state === 'NEXT' ? ' · prochaine étape' : ''}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

function DriverCard({ view }: { view: TrackingView }) {
  if (!view.driverFirstName) return null;
  return (
    <Card className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
        <IconUser size={22} aria-hidden />
      </span>
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-text-muted">Conducteur</p>
        <p className="text-base font-semibold text-text-primary">{view.driverFirstName}</p>
      </div>
    </Card>
  );
}

function HistoryCard({ view }: { view: TrackingView }) {
  if (view.events.length === 0) return null;
  return (
    <Card>
      <CardTitle icon={<IconClock size={16} aria-hidden />}>Historique</CardTitle>
      <ul className="mt-4 flex flex-col gap-3">
        {view.events.map((event, index) => (
          <li key={`${event.status}-${event.at}-${index}`} className="flex items-start gap-3">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${index === 0 ? 'bg-primary' : 'bg-border-strong'}`} aria-hidden />
            <div className="min-w-0">
              <p className={`text-sm ${index === 0 ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>{event.label}</p>
              <p className="text-xs text-text-muted">{formatDate(event.at)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export default function TrackingPage() {
  const params = useParams<{ number: string }>();
  const number = decodeURIComponent(params.number ?? '');
  const [view, setView] = useState<TrackingView | null>(null);
  const [error, setError] = useState<{ message: string; notFound: boolean } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (silent: boolean) => {
      if (!silent) setLoading(true);
      try {
        setView(await trackingApi.findPublic(number));
        setError(null);
      } catch (caught) {
        // Lors d'un rafraîchissement automatique, une coupure réseau ne doit pas effacer ce qui est déjà affiché.
        if (silent) return;
        const notFound = caught instanceof ApiError && (caught.statusCode === 404 || caught.statusCode === 400);
        setError({
          notFound,
          message:
            caught instanceof ApiError && notFound
              ? caught.message
              : caught instanceof ApiError && caught.statusCode === 429
                ? 'Trop de recherches en peu de temps. Patientez une minute puis réessayez.'
                : 'Impossible de charger le suivi pour le moment. Vérifiez votre connexion et réessayez.',
        });
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [number],
  );

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (view?.outcome !== 'ACTIVE') return undefined;
    const timer = window.setInterval(() => void load(true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [view?.outcome, load]);

  if (loading) {
    return (
      <TrackingShell title="Suivi du colis" subtitle="Chargement…">
        <div className="h-40 animate-pulse rounded-3xl bg-surface shadow-lg shadow-primary-dark/10" aria-busy="true" />
      </TrackingShell>
    );
  }

  if (!view) {
    return (
      <TrackingShell title="Suivi du colis">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger-light text-danger-dark">
              <IconAlertTriangle size={22} aria-hidden />
            </span>
            <p className="text-sm leading-relaxed text-text-secondary" role="alert">
              {error?.message}
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2">
            {!error?.notFound ? (
              <button
                type="button"
                onClick={() => void load(false)}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-md shadow-primary-dark/20 transition hover:bg-primary-dark"
              >
                <IconRefresh size={18} aria-hidden />
                Réessayer
              </button>
            ) : null}
            <Link
              href="/suivi"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary-light px-5 py-3 text-sm font-semibold text-primary transition hover:bg-primary-accent"
            >
              <IconPackage size={18} aria-hidden />
              Saisir un autre numéro
            </Link>
          </div>
        </Card>
      </TrackingShell>
    );
  }

  return (
    <TrackingShell title="Suivi du colis" subtitle={`Mis à jour le ${formatDate(view.updatedAt)}`}>
      <StatusCard view={view} />
      <LocationCard view={view} />
      <JourneyCard view={view} />
      <DriverCard view={view} />
      <HistoryCard view={view} />
      {view.outcome === 'ACTIVE' ? (
        <p className="px-1 text-center text-xs text-text-muted">Cette page se met à jour toute seule chaque minute.</p>
      ) : null}
    </TrackingShell>
  );
}
