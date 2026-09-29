// web-admin/src/app/(app)/trips/[id]/page.tsx
//
// v1 — Détail d'un trajet pour l'équipe : itinéraire complet (avec étapes
// intermédiaires), chauffeur, véhicule, places, prix, et les réservations
// (passagers) qui y sont rattachées. Lecture seule : un désaccord se
// traite depuis « Litiges ». Même structure que le détail Envoi.

'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { IconRoute } from '@tabler/icons-react';
import { BackHeader, Chip, Notice, SectionCard } from '@/components/admin/AdminUi';
import { useTripBookings, useTripDetail } from '@/hooks/useTrips';
import { formatMoney } from '@/utils/money';
import { TRIP_STATUS_LABELS, TRIP_STATUS_TONE, formatDateTime, routeLabel } from '@/utils/tripLabels';
import type { BookingStatus } from '@/types/trips.types';

const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING_PAYMENT: 'En attente de paiement',
  PAID: 'Payée',
  CONFIRMED: 'Confirmée',
  CANCELLED: 'Annulée',
  COMPLETED: 'Terminée',
  REFUNDED: 'Remboursée',
  DISPUTED: 'En litige',
};

const BOOKING_STATUS_TONE: Record<BookingStatus, 'primary' | 'neutral' | 'success' | 'accent' | 'danger'> = {
  PENDING_PAYMENT: 'accent',
  PAID: 'accent',
  CONFIRMED: 'primary',
  CANCELLED: 'neutral',
  COMPLETED: 'success',
  REFUNDED: 'neutral',
  DISPUTED: 'danger',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <div className="mt-0.5 break-words text-sm font-medium text-text-primary">{children}</div>
    </div>
  );
}

function MoneyTile({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${highlight ? 'bg-primary-light' : 'bg-border/30'}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">{label}</p>
      <p className={`mt-1 text-base font-bold sm:text-lg ${highlight ? 'text-primary' : 'text-text-primary'}`}>{value}</p>
    </div>
  );
}

function Loading() {
  return (
    <div className="max-w-3xl space-y-4">
      <div className="h-10 w-40 animate-pulse rounded-xl bg-border/50" />
      <div className="h-28 animate-pulse rounded-2xl bg-border/50" />
      <div className="h-40 animate-pulse rounded-2xl bg-border/50" />
    </div>
  );
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTripDetail(id);
  const { data: bookings } = useTripBookings(id);

  if (isError) {
    return (
      <div className="max-w-3xl space-y-6">
        <BackHeader href="/trips" backLabel="Trajets" title="Trajet introuvable" />
        <Notice tone="danger">Ce trajet n’existe plus ou n’a pas pu être chargé.</Notice>
      </div>
    );
  }
  if (isLoading || !trip) return <Loading />;

  const currencyCode = trip.currency?.isoCode;

  return (
    <div className="max-w-3xl space-y-5">
      <BackHeader
        href="/trips"
        backLabel="Trajets"
        title={routeLabel(trip)}
        subtitle={formatDateTime(trip.departureAt)}
        badge={<Chip tone={TRIP_STATUS_TONE[trip.status]}>{TRIP_STATUS_LABELS[trip.status]}</Chip>}
      />

      <SectionCard title="Prix" description="Le passager paie le prix par place fixé par le chauffeur, plus la commission de la plateforme.">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <MoneyTile label="Prix chauffeur (par place)" value={formatMoney(trip.pricePerSeat, currencyCode)} />
          <MoneyTile label="Prix passager (par place)" value={formatMoney(trip.customerPricePerSeat, currencyCode)} highlight />
        </div>
      </SectionCard>

      <SectionCard title="Itinéraire">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Départ">{trip.originLocation.label}</Field>
          <Field label="Arrivée">{trip.destinationLocation.label}</Field>
          <Field label="Places">
            {trip.availableSeats} libre{trip.availableSeats > 1 ? 's' : ''} sur {trip.totalSeats}
          </Field>
          <Field label="Trajet créé">{formatDateTime(trip.createdAt)}</Field>
        </div>
        <div className="flex flex-wrap gap-2">
          {trip.allowsLuggage ? <Chip tone="primary">Bagages acceptés</Chip> : null}
          {trip.allowsShipments ? <Chip tone="primary">Envois acceptés</Chip> : null}
        </div>
        {trip.notes ? <Field label="Notes du chauffeur">{trip.notes}</Field> : null}
      </SectionCard>

      {trip.stops.length > 0 ? (
        <SectionCard title="Étapes intermédiaires">
          <ol className="space-y-0">
            {trip.stops.map((stop, index) => (
              <li key={stop.id} className="flex gap-3">
                <div className="flex w-3 flex-col items-center">
                  <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-border" />
                  {index < trip.stops.length - 1 ? <span className="w-0.5 flex-1 bg-border" /> : null}
                </div>
                <div className="pb-4">
                  <p className="text-sm font-semibold text-text-primary">{stop.location.label}</p>
                  {stop.estimatedArrivalAt ? (
                    <p className="text-xs text-text-secondary">Arrivée estimée {formatDateTime(stop.estimatedArrivalAt)}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        </SectionCard>
      ) : null}

      <SectionCard title="Chauffeur">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-sm font-bold text-primary">
            {`${trip.driver.firstName.charAt(0)}${trip.driver.lastName.charAt(0)}`.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-text-primary">
              {trip.driver.firstName} {trip.driver.lastName}
            </p>
            <p className="text-xs text-text-secondary">
              {trip.driver.averageRating !== null
                ? `Note ${trip.driver.averageRating.toFixed(1)} · ${trip.driver.ratingsCount} avis`
                : 'Pas encore noté'}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Véhicule">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Modèle">
            {trip.vehicle.brand} {trip.vehicle.model}
          </Field>
          <Field label="Couleur">{trip.vehicle.color ?? '—'}</Field>
          <Field label="Immatriculation">{trip.vehicle.plateNumber}</Field>
          <Field label="Places du véhicule">{trip.vehicle.totalSeats}</Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Réservations"
        description="Chaque réservation regroupe les passagers d'un même client — pris en charge et déposés ensemble."
      >
        {!bookings ? (
          <div className="h-16 animate-pulse rounded-xl bg-border/30" />
        ) : bookings.length === 0 ? (
          <p className="text-sm text-text-secondary">Aucune réservation pour l’instant.</p>
        ) : (
          <div className="space-y-3">
            {bookings.map((booking) => (
              <div key={booking.id} className="rounded-2xl border border-border bg-background p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-text-primary">
                    {booking.customer.firstName} {booking.customer.lastName}
                  </p>
                  <Chip tone={BOOKING_STATUS_TONE[booking.status]}>{BOOKING_STATUS_LABELS[booking.status]}</Chip>
                </div>
                <p className="mt-1 text-xs text-text-secondary">
                  {booking.seatsCount} place{booking.seatsCount > 1 ? 's' : ''} · {formatMoney(booking.totalAmount, currencyCode)}
                  {booking.customerPhone ? (
                    <>
                      {' · '}
                      <a href={`tel:${booking.customerPhone}`} className="text-primary hover:underline">
                        {booking.customerPhone}
                      </a>
                    </>
                  ) : null}
                </p>
                {booking.passengers.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {booking.passengers.map((passenger) => (
                      <li key={passenger.id} className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <span className="font-medium text-text-primary">{passenger.fullName}</span>
                        {passenger.pickedUpAt ? (
                          <Chip tone="success">Pris en charge</Chip>
                        ) : (
                          <Chip tone="neutral">En attente</Chip>
                        )}
                        {passenger.droppedOffAt ? <Chip tone="success">Déposé</Chip> : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <p className="flex items-center gap-2 text-xs text-text-muted">
        <IconRoute size={14} />
        Un désaccord se traite depuis « Litiges », qui peut valider une prise en charge ou une dépose sans code.
      </p>
    </div>
  );
}