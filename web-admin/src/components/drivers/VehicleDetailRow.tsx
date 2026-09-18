// web-admin/src/components/drivers/VehicleDetailRow.tsx
'use client';

import React, { useState } from 'react';
import { IconCar, IconCheck, IconChevronDown, IconChevronUp, IconX } from '@tabler/icons-react';
import { Badge, IconActionButton } from '@/components/ui';
import { DocumentsPanel } from '@/components/layout/DocumentsPanel';
import { useRejectVehicle, useVerifyVehicle } from '@/hooks/useVehicles';
import { VEHICLE_TYPE_LABELS } from '@/utils/driverLabels';
import type { Vehicle } from '@/types/drivers.types';

const STATUS_TONE = {
  VERIFIED: 'success',
  REJECTED: 'danger',
  PENDING: 'accent',
} as const;
const STATUS_LABEL = {
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté',
  PENDING: 'En attente',
} as const;

/** Ligne véhicule avec ses infos (couleur, plaque, places...) et ses documents (carte grise, assurance) repliables — utilisée dans le modal chauffeur. */
export function VehicleDetailRow({ vehicle, driverId }: { vehicle: Vehicle; driverId: string }) {
  const verifyVehicle = useVerifyVehicle(driverId);
  const rejectVehicle = useRejectVehicle(driverId);
  const [showDocuments, setShowDocuments] = useState(false);

  return (
    <div className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-dark">
            <IconCar size={17} />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {vehicle.brand} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
            </p>
            <p className="truncate text-xs text-text-secondary">
              {VEHICLE_TYPE_LABELS[vehicle.type]} · {vehicle.color ?? 'Couleur non précisée'} · {vehicle.plateNumber} · {vehicle.totalSeats} places
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Badge label={STATUS_LABEL[vehicle.verificationStatus]} tone={STATUS_TONE[vehicle.verificationStatus]} />
          {vehicle.verificationStatus === 'PENDING' ? (
            <>
              <IconActionButton
                icon={IconCheck}
                label="Valider le véhicule"
                tone="success"
                onClick={() => verifyVehicle.mutate(vehicle.id)}
                loading={verifyVehicle.isPending}
              />
              <IconActionButton
                icon={IconX}
                label="Rejeter le véhicule"
                tone="danger"
                onClick={() => rejectVehicle.mutate(vehicle.id)}
                loading={rejectVehicle.isPending}
              />
            </>
          ) : null}
          <IconActionButton
            icon={showDocuments ? IconChevronUp : IconChevronDown}
            label={showDocuments ? 'Masquer les documents du véhicule' : 'Voir les documents du véhicule'}
            onClick={() => setShowDocuments((v) => !v)}
          />
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