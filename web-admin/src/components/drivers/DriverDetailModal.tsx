// web-admin/src/components/drivers/DriverDetailModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconEye, IconPlayerPause, IconPlayerPlay, IconRosetteDiscountCheck, IconShieldCheck } from '@tabler/icons-react';
import { Button, DetailField, DetailSection, EntityAvatar, Modal, TextArea, TintedIconButton } from '@/components/ui';
import { DocumentsPanel } from '@/components/layout/DocumentsPanel';
import { VehicleDetailRow } from './VehicleDetailRow';
import { useDriver, useReactivateDriver, useSuspendDriver, useVerifyDriver } from '@/hooks/useDrivers';
import { DRIVER_STATUS_LABELS } from '@/utils/driverLabels';
import { ApiError } from '@/services/api/ApiError';

export interface DriverDetailModalProps {
  open: boolean;
  onClose: () => void;
  driverId: string | null;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

export function DriverDetailModal({ open, onClose, driverId }: DriverDetailModalProps) {
  const router = useRouter();
  const { data: driver, isLoading, isError } = useDriver(driverId ?? undefined);
  const verifyDriver = useVerifyDriver(driverId ?? '');
  const suspendDriver = useSuspendDriver(driverId ?? '');
  const reactivateDriver = useReactivateDriver(driverId ?? '');

  const [showSuspendForm, setShowSuspendForm] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setShowSuspendForm(false);
    setReason('');
    setErrorMessage(undefined);
  }, [open, driverId]);

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
      setErrorMessage('Indique un motif de suspension.');
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={driver ? `${driver.firstName} ${driver.lastName}` : 'Chauffeur'}
      description={driver ? DRIVER_STATUS_LABELS[driver.status] : undefined}
      size="lg"
    >
      {isError ? (
        <p className="text-sm text-danger">Impossible de charger ce chauffeur.</p>
      ) : isLoading || !driver ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-start gap-4">
            <EntityAvatar
              initials={`${driver.firstName.charAt(0)}${driver.lastName.charAt(0)}`}
              imageUrl={driver.photoUrl}
              size="lg"
              tone={driver.status === 'VALIDATED' ? 'success' : 'primary'}
            />
            <div className="min-w-0 pt-1">
              <p className="flex items-center gap-1.5 truncate font-serif text-xl text-text-primary">
                {driver.firstName} {driver.lastName}
                {driver.isVerifiedBadge ? <IconRosetteDiscountCheck size={17} className="shrink-0 text-success-dark" /> : null}
              </p>
              <p className="mt-1 text-xs text-text-muted">
                {driver.city?.name ?? '—'} · {driver.country?.name ?? '—'}
              </p>
              <p className="text-xs text-text-muted">Membre depuis le {formatDate(driver.createdAt)}</p>
              {!driver.photoUrl ? <p className="mt-1 text-xs font-medium text-danger">Aucune photo de profil envoyée</p> : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {driver.status === 'PENDING' || driver.status === 'IN_VERIFICATION' ? (
              <TintedIconButton icon={IconShieldCheck} label="Valider le chauffeur" tone="success" onClick={handleVerify} loading={verifyDriver.isPending} />
            ) : null}
            <TintedIconButton icon={IconEye} label="Voir la fiche complète" tone="neutral" onClick={() => router.push(`/drivers/${driver.id}`)} />
            {driver.status === 'SUSPENDED' ? (
              <TintedIconButton
                icon={IconPlayerPlay}
                label="Réactiver"
                tone="success"
                onClick={() => reactivateDriver.mutate()}
                loading={reactivateDriver.isPending}
              />
            ) : (
              <TintedIconButton icon={IconPlayerPause} label="Suspendre" tone="danger" onClick={() => setShowSuspendForm(true)} />
            )}
          </div>

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          {showSuspendForm ? (
            <div className="space-y-2 rounded-lg bg-danger-light/40 p-3">
              <TextArea
                label="Motif de la suspension"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder="Expliquez la raison…"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setShowSuspendForm(false)}>
                  Annuler
                </Button>
                <Button variant="danger" loading={suspendDriver.isPending} onClick={handleSuspend}>
                  Confirmer
                </Button>
              </div>
            </div>
          ) : null}

          <DetailSection title="Activité">
            <DetailField label="Trajets terminés" value={driver.completedTripsCount} />
            <DetailField label="Envois terminés" value={driver.completedShipmentsCount} />
            <DetailField label="Annulations" value={driver.cancellationCount} />
            <DetailField
              label="Note moyenne"
              value={driver.averageRating ? `${driver.averageRating.toFixed(1)} (${driver.ratingsCount} avis)` : 'Aucun avis'}
            />
          </DetailSection>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Pièces d&apos;identité</h4>
            <DocumentsPanel ownerType="DRIVER" ownerId={driver.id} />
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Véhicules</h4>
            {driver.vehicles && driver.vehicles.length > 0 ? (
              <div className="space-y-2">
                {driver.vehicles.map((vehicle) => (
                  <VehicleDetailRow key={vehicle.id} vehicle={vehicle} driverId={driver.id} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-muted">Aucun véhicule enregistré.</p>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}