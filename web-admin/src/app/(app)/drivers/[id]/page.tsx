// web-admin/src/app/(app)/drivers/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft, IconCar, IconChevronDown, IconRosetteDiscountCheck, IconStarFilled } from '@tabler/icons-react';
import { Badge, Button, Card, TextArea } from '@/components/ui';
import { DocumentsPanel } from '@/components/layout/DocumentsPanel';
import { useDriver, useReactivateDriver, useSuspendDriver, useVerifyDriver } from '@/hooks/useDrivers';
import { useRejectVehicle, useVerifyVehicle } from '@/hooks/useVehicles';
import { DRIVER_STATUS_LABELS, DRIVER_STATUS_TONE, VEHICLE_TYPE_LABELS } from '@/utils/driverLabels';
import { ApiError } from '@/services/api/ApiError';
import type { Vehicle } from '@/types/drivers.types';

function VehicleRow({ vehicle, driverId }: { vehicle: Vehicle; driverId: string }) {
  const verifyVehicle = useVerifyVehicle(driverId);
  const rejectVehicle = useRejectVehicle(driverId);
  const [showDocuments, setShowDocuments] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-light text-primary-dark">
            <IconCar size={17} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              {vehicle.brand} {vehicle.model}
            </p>
            <p className="text-xs text-text-secondary">
              {VEHICLE_TYPE_LABELS[vehicle.type]} · {vehicle.plateNumber} · {vehicle.totalSeats} places
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            label={vehicle.verificationStatus === 'VERIFIED' ? 'Vérifié' : vehicle.verificationStatus === 'REJECTED' ? 'Rejeté' : 'En attente'}
            tone={vehicle.verificationStatus === 'VERIFIED' ? 'success' : vehicle.verificationStatus === 'REJECTED' ? 'danger' : 'accent'}
          />
          {vehicle.verificationStatus === 'PENDING' ? (
            <>
              <Button
                variant="success"
                className="px-2.5 py-1.5 text-xs"
                onClick={() => verifyVehicle.mutate(vehicle.id)}
                loading={verifyVehicle.isPending}
              >
                Valider
              </Button>
              <Button
                variant="outline"
                className="px-2.5 py-1.5 text-xs"
                onClick={() => rejectVehicle.mutate(vehicle.id)}
                loading={rejectVehicle.isPending}
              >
                Rejeter
              </Button>
            </>
          ) : null}
          <button
            onClick={() => setShowDocuments((v) => !v)}
            className="text-text-muted transition-transform hover:text-text-secondary"
            style={{ transform: showDocuments ? 'rotate(180deg)' : undefined }}
            aria-label="Voir les documents du véhicule"
          >
            <IconChevronDown size={16} />
          </button>
        </div>
      </div>
      {showDocuments ? (
        <div className="mt-3 border-t border-border pt-3">
          <DocumentsPanel ownerType="VEHICLE" ownerId={vehicle.id} />
        </div>
      ) : null}
    </div>
  );
}

export default function DriverDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: driver, isLoading, isError } = useDriver(id);
  const verifyDriver = useVerifyDriver(id);
  const suspendDriver = useSuspendDriver(id);
  const reactivateDriver = useReactivateDriver(id);

  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleVerify() {
    setErrorMessage(undefined);
    try {
      await verifyDriver.mutateAsync();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleSuspend() {
    setErrorMessage(undefined);
    if (reason.trim().length < 3) {
      setErrorMessage('Indiquez un motif de suspension.');
      return;
    }
    try {
      await suspendDriver.mutateAsync({ reason: reason.trim() });
      setReason('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) return <p className="text-sm text-danger">Chauffeur introuvable.</p>;
  if (isLoading || !driver) return <p className="text-sm text-text-secondary">Chargement…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/drivers" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        {driver.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={driver.photoUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-light text-sm font-semibold text-primary-dark">
            {driver.firstName.charAt(0)}
            {driver.lastName.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-text-primary">
            {driver.firstName} {driver.lastName}
            {driver.isVerifiedBadge ? <IconRosetteDiscountCheck size={20} className="text-success-dark" /> : null}
          </h1>
          {!driver.photoUrl ? <p className="text-xs font-medium text-danger">Aucune photo de profil envoyée</p> : null}
        </div>
      </div>

      <Card className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-text-secondary">Ville</p>
          <p className="text-sm font-medium text-text-primary">{driver.city?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Pays</p>
          <p className="text-sm font-medium text-text-primary">{driver.country?.name ?? '—'}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Trajets terminés</p>
          <p className="text-sm font-medium text-text-primary">{driver.completedTripsCount}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Envois terminés</p>
          <p className="text-sm font-medium text-text-primary">{driver.completedShipmentsCount}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary">Annulations</p>
          <p className="text-sm font-medium text-text-primary">{driver.cancellationCount}</p>
        </div>
        <div>
          <p className="flex items-center gap-1 text-xs text-text-secondary">
            <IconStarFilled size={12} className="text-accent" /> Note moyenne
          </p>
          <p className="text-sm font-medium text-text-primary">
            {driver.averageRating ? `${driver.averageRating.toFixed(1)} (${driver.ratingsCount} avis)` : 'Aucun avis'}
          </p>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Pièces d&apos;identité</h2>
        <DocumentsPanel ownerType="DRIVER" ownerId={driver.id} />
      </Card>

      <Card className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Véhicules</h2>
        {driver.vehicles && driver.vehicles.length > 0 ? (
          <div className="space-y-2">
            {driver.vehicles.map((vehicle) => (
              <VehicleRow key={vehicle.id} vehicle={vehicle} driverId={driver.id} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-muted">Aucun véhicule enregistré.</p>
        )}
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-text-primary">Statut du compte</h2>
          <Badge label={DRIVER_STATUS_LABELS[driver.status]} tone={DRIVER_STATUS_TONE[driver.status]} />
        </div>

        <div className="flex flex-wrap gap-2">
          {driver.status === 'PENDING' || driver.status === 'IN_VERIFICATION' ? (
            <Button variant="success" onClick={handleVerify} loading={verifyDriver.isPending}>
              Valider le chauffeur
            </Button>
          ) : null}
          {driver.status === 'SUSPENDED' ? (
            <Button variant="success" onClick={() => reactivateDriver.mutate()} loading={reactivateDriver.isPending}>
              Réactiver le compte
            </Button>
          ) : null}
        </div>

        {driver.status !== 'SUSPENDED' ? (
          <div className="space-y-3 border-t border-border pt-4">
            {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
            <TextArea
              label="Motif de suspension"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison de cette suspension…"
            />
            <Button variant="danger" onClick={handleSuspend} loading={suspendDriver.isPending}>
              Suspendre le chauffeur
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}