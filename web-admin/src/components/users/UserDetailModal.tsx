// web-admin/src/components/users/UserDetailModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IconTrash } from '@tabler/icons-react';
import { Badge, Button, Modal, TextArea, TextField } from '@/components/ui';
import { useActivateUser, useDeactivateUser, useSuspendUser, useUnsuspendUser, useUpdateUser } from '@/hooks/useUsers';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';
import { ApiError } from '@/services/api/ApiError';
import type { SafeUser } from '@/types/auth.types';

export interface UserDetailModalProps {
  open: boolean;
  onClose: () => void;
  user: SafeUser | null;
}

function fullNameOf(user: SafeUser): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.phone;
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

const HAS_PROFILE: SafeUser['accountType'][] = ['CUSTOMER', 'DRIVER'];

type ActiveAction = 'suspend' | 'deactivate' | null;

/** Fiche détaillée + actions d'un utilisateur, ouverte depuis une ligne de la liste. */
export function UserDetailModal({ open, onClose, user }: UserDetailModalProps) {
  const [displayUser, setDisplayUser] = useState<SafeUser | null>(user);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [activeAction, setActiveAction] = useState<ActiveAction>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const updateUser = useUpdateUser(user?.id ?? '');
  const suspendUser = useSuspendUser(user?.id ?? '');
  const unsuspendUser = useUnsuspendUser(user?.id ?? '');
  const deactivateUser = useDeactivateUser(user?.id ?? '');
  const activateUser = useActivateUser(user?.id ?? '');

  useEffect(() => {
    if (!open || !user) return;
    setDisplayUser(user);
    setEmail(user.email ?? '');
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setActiveAction(null);
    setSuspendReason('');
    setErrorMessage(undefined);
  }, [open, user]);

  if (!displayUser) return null;

  const hasProfile = HAS_PROFILE.includes(displayUser.accountType);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      const updated = await updateUser.mutateAsync({
        email: email || undefined,
        ...(hasProfile ? { firstName: firstName.trim(), lastName: lastName.trim() } : {}),
      });
      setDisplayUser(updated);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleSuspend() {
    if (suspendReason.trim().length < 3) {
      setErrorMessage('Indique un motif de suspension.');
      return;
    }
    setErrorMessage(undefined);
    try {
      const updated = await suspendUser.mutateAsync({ reason: suspendReason.trim() });
      setDisplayUser(updated);
      setActiveAction(null);
      setSuspendReason('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleUnsuspend() {
    setErrorMessage(undefined);
    try {
      const updated = await unsuspendUser.mutateAsync();
      setDisplayUser(updated);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDeactivate() {
    setErrorMessage(undefined);
    try {
      const updated = await deactivateUser.mutateAsync();
      setDisplayUser(updated);
      setActiveAction(null);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleActivate() {
    setErrorMessage(undefined);
    try {
      const updated = await activateUser.mutateAsync();
      setDisplayUser(updated);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={fullNameOf(displayUser)}
      description={`${displayUser.phone} · ${ACCOUNT_TYPE_LABELS[displayUser.accountType]}`}
      size="lg"
      footer={
        activeAction === 'suspend' ? (
          <div className="flex-1 space-y-3 rounded-lg bg-danger-light/40 p-3">
            <TextArea
              label="Motif de la suspension"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              rows={2}
              placeholder="Expliquez la raison…"
              autoFocus
            />
            {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  setActiveAction(null);
                  setSuspendReason('');
                  setErrorMessage(undefined);
                }}
              >
                Annuler
              </Button>
              <Button variant="danger" loading={suspendUser.isPending} onClick={handleSuspend}>
                Confirmer la suspension
              </Button>
            </div>
          </div>
        ) : activeAction === 'deactivate' ? (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-light/40 px-3 py-2">
            <span className="text-sm text-danger-dark">Désactiver ce compte ?</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setActiveAction(null)}>
                Annuler
              </Button>
              <Button variant="danger" loading={deactivateUser.isPending} onClick={handleDeactivate}>
                Confirmer
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="mr-auto flex flex-wrap gap-2">
              {displayUser.isSuspended ? (
                <Button variant="secondary" onClick={handleUnsuspend} loading={unsuspendUser.isPending}>
                  Lever la suspension
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => setActiveAction('suspend')}>
                  Suspendre
                </Button>
              )}
              {displayUser.isActive ? (
                <Button variant="danger" onClick={() => setActiveAction('deactivate')}>
                  <IconTrash size={16} />
                  Supprimer
                </Button>
              ) : (
                <Button variant="success" onClick={handleActivate} loading={activateUser.isPending}>
                  Réactiver le compte
                </Button>
              )}
            </div>
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" form="user-edit-form" loading={updateUser.isPending}>
              Enregistrer
            </Button>
          </>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border p-3 text-sm">
          <span className="text-text-secondary">Téléphone vérifié</span>
          <span className="text-right">
            <Badge label={displayUser.isPhoneVerified ? 'Oui' : 'Non'} tone={displayUser.isPhoneVerified ? 'success' : 'neutral'} />
          </span>
          <span className="text-text-secondary">2FA activée</span>
          <span className="text-right">
            <Badge label={displayUser.isTwoFactorEnabled ? 'Oui' : 'Non'} tone={displayUser.isTwoFactorEnabled ? 'success' : 'neutral'} />
          </span>
          <span className="text-text-secondary">Dernière connexion</span>
          <span className="text-right text-text-primary">{formatDate(displayUser.lastLoginAt)}</span>
          <span className="text-text-secondary">Membre depuis</span>
          <span className="text-right text-text-primary">{formatDate(displayUser.createdAt)}</span>
        </div>

        {!displayUser.isActive ? (
          <p className="rounded-lg bg-danger-light p-3 text-sm text-danger-dark">Ce compte est désactivé.</p>
        ) : null}
        {displayUser.isSuspended && displayUser.suspendedReason ? (
          <p className="rounded-lg bg-danger-light p-3 text-sm text-danger-dark">Motif de suspension : {displayUser.suspendedReason}</p>
        ) : null}

        <form id="user-edit-form" onSubmit={handleSubmit} className="space-y-3">
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" />
          {hasProfile ? (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <TextField label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          ) : (
            <p className="text-xs text-text-muted">Les comptes Support/SuperAdmin n'ont pas de profil nominatif à modifier ici.</p>
          )}
          {errorMessage && activeAction === null ? <p className="text-sm text-danger">{errorMessage}</p> : null}
        </form>

        {displayUser.accountType === 'SUPPORT' || displayUser.accountType === 'SUPERADMIN' ? (
          <Link href={`/users/${displayUser.id}`} className="inline-block text-sm text-primary hover:underline">
            Voir la fiche complète (gestion des rôles) →
          </Link>
        ) : null}
      </div>
    </Modal>
  );
}