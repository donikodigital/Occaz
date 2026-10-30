// web-admin/src/components/drivers/DriverProfile.tsx
'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  IconActivity,
  IconAlertTriangle,
  IconAddressBook,
  IconCar,
  IconCheck,
  IconCopy,
  IconEye,
  IconFingerprint,
  IconId,
  IconMail,
  IconPhone,
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
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS } from '@/utils/permissions';

/** Une ligne de coordonnées : icône, libellé, valeur (lien cliquable si `href`), badge facultatif et bouton « Copier ». */
function ContactRow({
  icon,
  label,
  value,
  href,
  badge,
  mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
  href?: string;
  badge?: { text: string; ok: boolean };
  mono?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible : la valeur reste sélectionnable à l'écran.
    }
  }

  const valueClass = `break-all text-sm font-semibold text-slate-900 ${mono ? 'font-mono text-[13px]' : ''}`;

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3 shadow-sm ring-1 ring-inset ring-slate-200/70">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-slate-900/5">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{label}</p>
          {badge ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${
                badge.ok ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
              }`}
            >
              {badge.text}
            </span>
          ) : null}
        </div>
        {value ? (
          href ? (
            <a href={href} className={`${valueClass} hover:text-primary hover:underline`}>
              {value}
            </a>
          ) : (
            <p className={valueClass}>{value}</p>
          )
        ) : (
          <p className="text-sm font-medium text-slate-400">Non renseigné</p>
        )}
      </div>
      {value ? (
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copier : ${label}`}
          title={copied ? 'Copié' : 'Copier'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-slate-500 shadow-sm ring-1 ring-slate-900/5 transition hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary active:scale-95"
        >
          {copied ? <IconCheck size={16} className="text-emerald-600" /> : <IconCopy size={16} />}
        </button>
      ) : null}
    </div>
  );
}

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
  const { can } = usePermissions();

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
        Impossible de charger ce conducteur.
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
            <p className="text-xs font-bold uppercase tracking-wider text-white/80">Conducteur</p>
            <h2 className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xl font-extrabold leading-tight tracking-tight">
              <span className="break-words">
                {driver.firstName} {driver.lastName}
              </span>
              {driver.isVerifiedBadge ? (
                <IconRosetteDiscountCheck size={22} className="shrink-0" aria-label="Conducteur vérifié" />
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
          {canVerify && can(PERMISSIONS.DRIVER_VERIFY) ? (
            <ToneButton
              variant="success"
              size="fluid"
              icon={<IconShieldCheck size={16} />}
              className="w-full sm:w-auto"
              onClick={handleVerify}
              loading={verifyDriver.isPending}
            >
              Valider le conducteur
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

          {!can(PERMISSIONS.DRIVER_SUSPEND) ? null : isSuspended ? (
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

      {/* ---------- Coordonnées ---------- */}
      <Panel title="Coordonnées" icon={<IconAddressBook size={18} />} delay={110}>
        <div className="space-y-2.5">
          <ContactRow
            icon={<IconPhone size={18} />}
            label="Téléphone"
            value={driver.user?.phone}
            href={driver.user?.phone ? `tel:${driver.user.phone}` : undefined}
            badge={driver.user ? { text: driver.user.isPhoneVerified ? 'Vérifié' : 'Non vérifié', ok: driver.user.isPhoneVerified } : undefined}
          />
          <ContactRow
            icon={<IconMail size={18} />}
            label="E-mail"
            value={driver.user?.email}
            href={driver.user?.email ? `mailto:${driver.user.email}` : undefined}
            badge={
              driver.user?.email
                ? { text: driver.user.isEmailVerified ? 'Vérifié' : 'Non vérifié', ok: driver.user.isEmailVerified }
                : undefined
            }
          />
          <ContactRow icon={<IconFingerprint size={18} />} label="ID conducteur" value={driver.id} mono />
          {driver.user?.id ? <ContactRow icon={<IconId size={18} />} label="ID du compte (utilisateur)" value={driver.user.id} mono /> : null}
        </div>
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