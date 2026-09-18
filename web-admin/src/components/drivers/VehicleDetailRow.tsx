// web-admin/src/components/drivers/VehicleDetailRow.tsx
'use client';

import React, { useState } from 'react';
import { IconCar, IconChevronDown } from '@tabler/icons-react';
import { Badge, Button } from '@/components/ui';
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary-dark">
            <IconCar size={17} />
          </div>
          <div>
            <p className="text-sm font-medium text-text-primary">
              {vehicle.brand} {vehicle.model} {vehicle.year ? `(${vehicle.year})` : ''}
            </p>
            <p className="text-xs text-text-secondary">
              {VEHICLE_TYPE_LABELS[vehicle.type]} · {vehicle.color ?? 'Couleur non précisée'} · {vehicle.plateNumber} · {vehicle.totalSeats} places
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge label={STATUS_LABEL[vehicle.verificationStatus]} tone={STATUS_TONE[vehicle.verificationStatus]} />
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
            type="button"
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