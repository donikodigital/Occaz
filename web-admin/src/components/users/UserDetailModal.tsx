// web-admin/src/components/users/UserDetailModal.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconEye, IconPencil, IconPlayerPause, IconPlayerPlay, IconTrash } from '@tabler/icons-react';
import { Button, DetailField, DetailSection, EntityAvatar, Modal, TextArea, TextField, TintedIconButton } from '@/components/ui';
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

function initialsOf(user: SafeUser): string {
  const name = fullNameOf(user);
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

function formatDateTime(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
}

const HAS_PROFILE: SafeUser['accountType'][] = ['CUSTOMER', 'DRIVER'];

type ActiveAction = 'suspend' | 'deactivate' | null;

/** Fiche détaillée + actions d'un utilisateur, ouverte depuis une carte de la liste. */
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

  function focusEditForm() {
    document.getElementById('user-edit-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('user-edit-email')?.focus();
  }

  return (
    <Modal open={open} onClose={onClose} title={fullNameOf(displayUser)} description={ACCOUNT_TYPE_LABELS[displayUser.accountType]} size="lg">
      <div className="space-y-5">
        <div className="flex items-start gap-4">
          <EntityAvatar initials={initialsOf(displayUser)} size="lg" tone={displayUser.isActive ? 'primary' : 'neutral'} />
          <div className="min-w-0 pt-1">
            <p className="truncate font-serif text-xl text-text-primary">{fullNameOf(displayUser)}</p>
            <p className="mt-1 text-xs text-text-muted">ID : {displayUser.id.slice(0, 8)}</p>
            <p className="text-xs text-text-muted">Membre depuis le {formatDate(displayUser.createdAt)}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <TintedIconButton icon={IconPencil} label="Modifier" tone="primary" onClick={focusEditForm} />
          <TintedIconButton icon={IconEye} label="Voir la fiche complète" tone="neutral" onClick={() => window.open(`/users/${displayUser.id}`, '_self')} />
          {displayUser.isSuspended ? (
            <TintedIconButton icon={IconPlayerPlay} label="Lever la suspension" tone="success" onClick={handleUnsuspend} loading={unsuspendUser.isPending} />
          ) : (
            <TintedIconButton icon={IconPlayerPause} label="Suspendre" tone="accent" onClick={() => setActiveAction('suspend')} />
          )}
          {displayUser.isActive ? (
            <TintedIconButton icon={IconTrash} label="Supprimer" tone="danger" onClick={() => setActiveAction('deactivate')} />
          ) : (
            <TintedIconButton icon={IconPlayerPlay} label="Réactiver le compte" tone="success" onClick={handleActivate} loading={activateUser.isPending} />
          )}
        </div>

        {activeAction === 'suspend' ? (
          <div className="space-y-3 rounded-lg bg-danger-light/40 p-3">
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
        ) : null}

        {activeAction === 'deactivate' ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-light/40 px-3 py-2">
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
        ) : null}

        {!displayUser.isActive ? (
          <p className="rounded-lg bg-danger-light p-3 text-sm text-danger-dark">Ce compte est désactivé.</p>
        ) : null}
        {displayUser.isSuspended && displayUser.suspendedReason ? (
          <p className="rounded-lg bg-danger-light p-3 text-sm text-danger-dark">Motif de suspension : {displayUser.suspendedReason}</p>
        ) : null}

        <DetailSection title="Identité & contact">
          <DetailField label="Rôle" value={ACCOUNT_TYPE_LABELS[displayUser.accountType]} />
          <DetailField label="Téléphone" value={displayUser.phone} />
          <DetailField label="Email" value={displayUser.email ?? '—'} />
          <DetailField label="Statut" value={displayUser.isSuspended ? 'Suspendu' : displayUser.isActive ? 'Actif' : 'Désactivé'} />
        </DetailSection>

        <DetailSection title="Sécurité & connexion">
          <DetailField label="Téléphone vérifié" value={displayUser.isPhoneVerified ? 'Oui' : 'Non'} />
          <DetailField label="2FA activée" value={displayUser.isTwoFactorEnabled ? 'Oui' : 'Non'} />
          <DetailField label="Dernière connexion" value={formatDateTime(displayUser.lastLoginAt)} />
        </DetailSection>

        <form id="user-edit-form" onSubmit={handleSubmit} className="space-y-3 border-t border-border pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-primary">Modifier</h4>
          <TextField id="user-edit-email" label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" />
          {hasProfile ? (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              <TextField label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          ) : (
            <p className="text-xs text-text-muted">Les comptes Support/SuperAdmin n'ont pas de profil nominatif à modifier ici.</p>
          )}
          {errorMessage && activeAction === null ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          <Button type="submit" loading={updateUser.isPending}>
            Enregistrer
          </Button>
        </form>
      </div>
    </Modal>
  );
}