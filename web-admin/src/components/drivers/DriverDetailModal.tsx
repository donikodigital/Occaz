// web-admin/src/components/drivers/DriverDetailModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconRosetteDiscountCheck, IconStarFilled } from '@tabler/icons-react';
import { Badge, Button, Modal, TextArea } from '@/components/ui';
import { DocumentsPanel } from '@/components/layout/DocumentsPanel';
import { VehicleDetailRow } from './VehicleDetailRow';
import { useDriver, useReactivateDriver, useSuspendDriver, useVerifyDriver } from '@/hooks/useDrivers';
import { DRIVER_STATUS_LABELS, DRIVER_STATUS_TONE } from '@/utils/driverLabels';
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

/**
 * Fiche chauffeur complète en modal : infos, documents d'identité, véhicules
 * avec leurs propres documents, et actions Valider/Suspendre/Réactiver.
 * Charge toujours le détail via useDriver(driverId) plutôt que de recevoir
 * l'objet de la liste, car GET /driver-profiles (liste) n'inclut pas les
 * véhicules — seul GET /driver-profiles/:id (findOne) le fait.
 */
export function DriverDetailModal({ open, onClose, driverId }: DriverDetailModalProps) {
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
      description={driver ? `${driver.city?.name ?? '—'} · ${driver.country?.name ?? '—'}` : undefined}
      size="lg"
    >
      {isError ? (
        <p className="text-sm text-danger">Impossible de charger ce chauffeur.</p>
      ) : isLoading || !driver ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            {driver.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={driver.photoUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-light text-base font-semibold text-primary-dark">
                {driver.firstName.charAt(0)}
                {driver.lastName.charAt(0)}
              </div>
            )}
            <div>
              <p className="flex items-center gap-1.5 font-semibold text-text-primary">
                {driver.firstName} {driver.lastName}
                {driver.isVerifiedBadge ? <IconRosetteDiscountCheck size={16} className="text-success-dark" /> : null}
              </p>
              <Badge label={DRIVER_STATUS_LABELS[driver.status]} tone={DRIVER_STATUS_TONE[driver.status]} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-sm">
            <span className="text-text-secondary">Date de naissance</span>
            <span className="text-right text-text-primary">{formatDate(driver.dateOfBirth)}</span>
            <span className="text-text-secondary">Mobile money</span>
            <span className="text-right text-text-primary">{driver.mobileMoneyNumber ?? '—'}</span>
            <span className="text-text-secondary">Trajets terminés</span>
            <span className="text-right text-text-primary">{driver.completedTripsCount}</span>
            <span className="text-text-secondary">Envois terminés</span>
            <span className="text-right text-text-primary">{driver.completedShipmentsCount}</span>
            <span className="text-text-secondary">Annulations</span>
            <span className="text-right text-text-primary">{driver.cancellationCount}</span>
            <span className="flex items-center gap-1 text-text-secondary">
              <IconStarFilled size={12} className="text-accent" /> Note moyenne
            </span>
            <span className="text-right text-text-primary">
              {driver.averageRating ? `${driver.averageRating.toFixed(1)} (${driver.ratingsCount} avis)` : 'Aucun avis'}
            </span>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">Pièces d&apos;identité</h3>
            <DocumentsPanel ownerType="DRIVER" ownerId={driver.id} />
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-text-primary">Véhicules</h3>
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

          <div className="space-y-3 border-t border-border pt-4">
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
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {driver.status === 'PENDING' || driver.status === 'IN_VERIFICATION' ? (
                  <Button variant="success" onClick={() => verifyDriver.mutate()} loading={verifyDriver.isPending}>
                    Valider le chauffeur
                  </Button>
                ) : null}
                {driver.status === 'SUSPENDED' ? (
                  <Button variant="success" onClick={() => reactivateDriver.mutate()} loading={reactivateDriver.isPending}>
                    Réactiver le compte
                  </Button>
                ) : (
                  <Button variant="danger" onClick={() => setShowSuspendForm(true)}>
                    Suspendre
                  </Button>
                )}
                <Link href={`/drivers/${driver.id}`} className="ml-auto text-sm text-primary hover:underline">
                  Voir la fiche complète →
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}