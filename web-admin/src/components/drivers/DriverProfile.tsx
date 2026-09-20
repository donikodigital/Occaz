// web-admin/src/components/drivers/DriverProfile.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconActivity,
  IconAlertTriangle,
  IconCar,
  IconEye,
  IconId,
  IconMapPin,
  IconPackage,
  IconPlayerPause,
  IconPlayerPlay,
  IconRoute,
  IconRosetteDiscountCheck,
  IconShieldCheck,
  IconStarFilled,
  IconX,
} from '@tabler/icons-react';
import { DocumentsPanel } from '@/components/layout/DocumentsPanel';
import { Panel, Skeleton, TextAreaField } from '@/components/disputes/disputeUi';
import { VehicleDetailRow } from './VehicleDetailRow';
import { DriverAvatar, DriverStatusPill, StatTile, ToneButton, driverStatusStyle, formatDate } from './driverUi';
import { useDriver, useReactivateDriver, useSuspendDriver, useVerifyDriver } from '@/hooks/useDrivers';
import { ApiError } from '@/services/api/ApiError';

type DriverProfileProps = {
  driverId: string;
  /** Affiche le bouton « Voir la fiche complète » (utile dans le modal). */
  showFullPageLink?: boolean;
};

export function DriverProfile({ driverId, showFullPageLink = false }: DriverProfileProps) {
  const router = useRouter();
  const { data: driver, isLoading, isError } = useDriver(driverId);
  const verifyDriver = useVerifyDriver(driverId);
  const suspendDriver = useSuspendDriver(driverId);
  const reactivateDriver = useReactivateDriver(driverId);

  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [photoFailed, setPhotoFailed] = useState(false);

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
      setShowSuspendForm(false);
      setReason('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) {
    return (
      <div className="rounded-2xl bg-rose-50 p-5 text-sm font-semibold text-rose-700 ring-1 ring-rose-200">
        Impossible de charger ce chauffeur.
      </div>
    );
  }

  if (isLoading || !driver) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-28" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    );
  }

  const style = driverStatusStyle(driver.status);
  const missingPhoto = !driver.photoUrl || photoFailed;
  const canVerify = driver.status === 'PENDING' || driver.status === 'IN_VERIFICATION';
  const isSuspended = driver.status === 'SUSPENDED';
  const vehicles = driver.vehicles ?? [];

  return (
    <div className="space-y-4">
      {/* ---------- En-tête ---------- */}
      <div
        className={`dispute-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br ${style.banner} p-5 text-white shadow-xl ${style.glow}`}
      >
        <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/15 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-14 left-8 h-36 w-36 rounded-full bg-white/10 blur-2xl" />

        <div className="relative flex items-center gap-4">
          <DriverAvatar
            firstName={driver.firstName}
            lastName={driver.lastName}
            photoUrl={driver.photoUrl}
            size="xl"
            onPhotoError={() => setPhotoFailed(true)}
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">Chauffeur</p>
            <h2 className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xl font-extrabold leading-tight tracking-tight">
              <span className="break-words">
                {driver.firstName} {driver.lastName}
              </span>
              {driver.isVerifiedBadge ? (
                <IconRosetteDiscountCheck size={22} className="shrink-0" aria-label="Chauffeur vérifié" />
              ) : null}
            </h2>
            <p className="mt-1 flex items-center gap-1 text-sm font-medium text-white/90">
              <IconMapPin size={14} className="shrink-0" />
              {driver.city?.name ?? '—'} · {driver.country?.name ?? '—'}
            </p>
            <p className="text-xs font-medium text-white/75">Membre depuis le {formatDate(driver.createdAt)}</p>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          <DriverStatusPill status={driver.status} onDark />
          {missingPhoto ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-inset ring-white/30">
              <IconAlertTriangle size={12} />
              Aucune photo de profil valide
            </span>
          ) : null}
        </div>
      </div>

      {/* ---------- Actions ---------- */}
      <Panel title="Actions" icon={<IconShieldCheck size={18} />} delay={80}>
        <div className="flex flex-wrap gap-2.5">
          {canVerify ? (
            <ToneButton
              variant="success"
              size="fluid"
              icon={<IconShieldCheck size={16} />}
              className="w-full sm:w-auto"
              onClick={handleVerify}
              loading={verifyDriver.isPending}
            >
              Valider le chauffeur
            </ToneButton>
          ) : null}

          {showFullPageLink ? (
            <ToneButton
              variant="secondary"
              size="fluid"
              icon={<IconEye size={16} />}
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => router.push(`/drivers/${driver.id}`)}
            >
              <span className="sm:hidden">Fiche complète</span>
              <span className="hidden sm:inline">Voir la fiche complète</span>
            </ToneButton>
          ) : null}

          {isSuspended ? (
            <ToneButton
              variant="success"
              size="fluid"
              icon={<IconPlayerPlay size={16} />}
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => reactivateDriver.mutate()}
              loading={reactivateDriver.isPending}
            >
              <span className="sm:hidden">Réactiver</span>
              <span className="hidden sm:inline">Réactiver le compte</span>
            </ToneButton>
          ) : (
            <ToneButton
              variant="softDanger"
              size="fluid"
              icon={<IconPlayerPause size={16} />}
              className="min-w-0 flex-1 sm:flex-none"
              onClick={() => setShowSuspendForm(true)}
            >
              Suspendre
            </ToneButton>
          )}
        </div>

        {errorMessage ? (
          <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
            {errorMessage}
          </p>
        ) : null}

        {showSuspendForm && !isSuspended ? (
          <div className="mt-4 space-y-3 rounded-2xl bg-rose-50 p-4 ring-1 ring-inset ring-rose-100">
            <TextAreaField
              label="Motif de la suspension"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison de cette suspension…"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <ToneButton
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowSuspendForm(false);
                  setErrorMessage(undefined);
                }}
              >
                Annuler
              </ToneButton>
              <ToneButton
                variant="danger"
                size="sm"
                icon={<IconPlayerPause size={14} />}
                loading={suspendDriver.isPending}
                onClick={handleSuspend}
              >
                Confirmer la suspension
              </ToneButton>
            </div>
          </div>
        ) : null}
      </Panel>

      {/* ---------- Activité ---------- */}
      <Panel title="Activité" icon={<IconActivity size={18} />} delay={140}>
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            tone="indigo"
            icon={<IconRoute size={18} />}
            label="Trajets terminés"
            value={driver.completedTripsCount}
          />
          <StatTile
            tone="sky"
            icon={<IconPackage size={18} />}
            label="Envois terminés"
            value={driver.completedShipmentsCount}
          />
          <StatTile tone="rose" icon={<IconX size={18} />} label="Annulations" value={driver.cancellationCount} />
          <StatTile
            tone="amber"
            icon={<IconStarFilled size={18} />}
            label="Note moyenne"
            value={driver.averageRating ? driver.averageRating.toFixed(1) : '—'}
            hint={driver.averageRating ? `${driver.ratingsCount} avis` : 'Aucun avis'}
          />
        </div>
      </Panel>

      {/* ---------- Pièces d'identité ---------- */}
      <Panel title="Pièces d'identité" icon={<IconId size={18} />} delay={200}>
        <DocumentsPanel ownerType="DRIVER" ownerId={driver.id} />
      </Panel>

      {/* ---------- Véhicules ---------- */}
      <Panel title={`Véhicules (${vehicles.length})`} icon={<IconCar size={18} />} delay={260}>
        {vehicles.length > 0 ? (
          <div className="space-y-3">
            {vehicles.map((vehicle) => (
              <VehicleDetailRow key={vehicle.id} vehicle={vehicle} driverId={driver.id} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-slate-200 px-4 py-6 text-center text-sm font-medium text-slate-500">
            Aucun véhicule enregistré.
          </div>
        )}
      </Panel>
    </div>
  );
}