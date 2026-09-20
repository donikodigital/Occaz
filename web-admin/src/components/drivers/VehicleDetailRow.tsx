// web-admin/src/components/drivers/VehicleDetailRow.tsx
'use client';

import React, { useState } from 'react';
import { IconCar, IconCheck, IconChevronDown, IconChevronUp, IconFileText, IconX } from '@tabler/icons-react';
import { DocumentsPanel } from '@/components/layout/DocumentsPanel';
import { useRejectVehicle, useVerifyVehicle } from '@/hooks/useVehicles';
import { VEHICLE_TYPE_LABELS } from '@/utils/driverLabels';
import { ToneButton } from './driverUi';
import type { Vehicle } from '@/types/drivers.types';

const VEHICLE_STATUS_STYLE = {
  VERIFIED: {
    label: 'Vérifié',
    pill: 'bg-[#e6f1fa] text-[#0a4a7d] ring-[#9fc8e8]',
    dot: 'bg-[#0b6aa8]',
    bar: 'from-[#0b62a3] to-[#083a63]',
  },
  REJECTED: {
    label: 'Rejeté',
    pill: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    bar: 'from-rose-500 to-red-600',
  },
  PENDING: {
    label: 'En attente',
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    bar: 'from-amber-400 to-orange-500',
  },
} as const;

function Chip({ children, muted = false }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-lg bg-slate-100 px-2 py-1 text-xs font-semibold ${
        muted ? 'italic text-slate-400' : 'text-slate-600'
      }`}
    >
      {children}
    </span>
  );
}

type VehicleDetailRowProps = {
  vehicle: Vehicle;
  driverId: string;
  /** Documents (carte grise, assurance) affichés dès l'ouverture. */
  defaultOpen?: boolean;
};

/** Carte véhicule : infos complètes, validation/rejet et documents. Utilisée dans la fiche chauffeur. */
export function VehicleDetailRow({ vehicle, driverId, defaultOpen = true }: VehicleDetailRowProps) {
  const verifyVehicle = useVerifyVehicle(driverId);
  const rejectVehicle = useRejectVehicle(driverId);
  const [showDocuments, setShowDocuments] = useState(defaultOpen);
  const status = VEHICLE_STATUS_STYLE[vehicle.verificationStatus];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-white to-slate-50 p-4 pl-5 shadow-md shadow-slate-900/10 ring-1 ring-slate-200">
      <span className={`absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b ${status.bar}`} />

      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/30">
          <IconCar size={22} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-base font-bold leading-snug text-slate-900">
              {vehicle.brand} {vehicle.model}
              {vehicle.year ? <span className="ml-1 font-semibold text-slate-400">({vehicle.year})</span> : null}
            </p>
            <span
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${status.pill}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
              {status.label}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip>{VEHICLE_TYPE_LABELS[vehicle.type]}</Chip>
            {vehicle.color ? <Chip>{vehicle.color}</Chip> : <Chip muted>Couleur non précisée</Chip>}
            <Chip>{vehicle.totalSeats} places</Chip>
          </div>
        </div>
      </div>

      {/* Valider / Rejeter (uniquement si en attente) */}
      {vehicle.verificationStatus === 'PENDING' ? (
        <div className="mt-4 grid grid-cols-2 gap-2">
          <ToneButton
            variant="success"
            size="sm"
            className="w-full"
            icon={<IconCheck size={14} />}
            onClick={() => verifyVehicle.mutate(vehicle.id)}
            loading={verifyVehicle.isPending}
          >
            Valider
          </ToneButton>
          <ToneButton
            variant="softDanger"
            size="sm"
            className="w-full"
            icon={<IconX size={14} />}
            onClick={() => rejectVehicle.mutate(vehicle.id)}
            loading={rejectVehicle.isPending}
          >
            Rejeter
          </ToneButton>
        </div>
      ) : null}

      {/* Plaque + Documents sur la même ligne */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="min-w-0 truncate rounded-md border-2 border-slate-800 bg-white px-2 py-0.5 font-mono text-xs font-extrabold tracking-wider text-slate-900">
          {vehicle.plateNumber}
        </span>

        <ToneButton
          variant="secondary"
          size="sm"
          className="shrink-0"
          aria-expanded={showDocuments}
          icon={<IconFileText size={14} />}
          onClick={() => setShowDocuments((value) => !value)}
        >
          Documents
          {showDocuments ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </ToneButton>
      </div>

      {showDocuments ? (
        <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-inset ring-slate-200">
          <DocumentsPanel ownerType="VEHICLE" ownerId={vehicle.id} />
        </div>
      ) : null}
    </div>
  );
}