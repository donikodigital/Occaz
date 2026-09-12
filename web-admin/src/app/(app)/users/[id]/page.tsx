// web-admin/src/app/(app)/users/[id]/page.tsx
'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Badge, Button, Card, Select, TextArea } from '@/components/ui';
import { useSuspendUser, useUnsuspendUser, useUser } from '@/hooks/useUsers';
import { useAssignRole, useRevokeRole, useRoles, useUserRoles } from '@/hooks/useRbac';
import { ACCOUNT_TYPE_LABELS } from '@/utils/userLabels';
import { ApiError } from '@/services/api/ApiError';

function UserRolesSection({ userId }: { userId: string }) {
  const { data: assignments, isLoading } = useUserRoles(userId);
  const { data: allRoles } = useRoles();
  const assignRole = useAssignRole(userId);
  const revokeRole = useRevokeRole(userId);
  const [selectedRoleId, setSelectedRoleId] = useState('');

  return (
    <Card className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Rôles</h2>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : assignments && assignments.length > 0 ? (
        <div className="space-y-2">
          {assignments.map((assignment) => (
            <div key={assignment.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
              <div>
                <p className="text-sm font-medium text-text-primary">{assignment.role.name}</p>
                {assignment.country ? <p className="text-xs text-text-secondary">Limité à {assignment.country.name}</p> : null}
              </div>
              <button
                onClick={() => revokeRole.mutate(assignment.id)}
                className="text-xs text-danger hover:underline"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-muted">Aucun rôle attribué.</p>
      )}

      <div className="flex items-end gap-3">
        <Select label="Attribuer un rôle" value={selectedRoleId} onChange={(e) => setSelectedRoleId(e.target.value)} className="max-w-xs">
          <option value="">Choisir…</option>
          {(allRoles ?? []).map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </Select>
        <Button
          disabled={!selectedRoleId}
          loading={assignRole.isPending}
          onClick={() => {
            assignRole.mutate({ userId, roleId: selectedRoleId });
            setSelectedRoleId('');
          }}
        >
          Attribuer
        </Button>
      </div>
    </Card>
  );
}

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: user, isLoading, isError } = useUser(id);
  const suspendUser = useSuspendUser(id);
  const unsuspendUser = useUnsuspendUser(id);

  const [reason, setReason] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSuspend() {
    setErrorMessage(undefined);
    if (reason.trim().length < 3) {
      setErrorMessage('Indiquez un motif de suspension.');
      return;
    }
    try {
      await suspendUser.mutateAsync({ reason: reason.trim() });
      setReason('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) return <p className="text-sm text-danger">Utilisateur introuvable.</p>;
  if (isLoading || !user) return <p className="text-sm text-text-secondary">Chargement…</p>;

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/users" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">{user.phone}</h1>
      </div>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Rôle</span>
          <span className="text-sm font-medium text-text-primary">{ACCOUNT_TYPE_LABELS[user.accountType]}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Email</span>
          <span className="text-sm font-medium text-text-primary">{user.email ?? '—'}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Téléphone vérifié</span>
          <Badge label={user.isPhoneVerified ? 'Oui' : 'Non'} tone={user.isPhoneVerified ? 'success' : 'neutral'} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-secondary">Statut</span>
          {user.isSuspended ? <Badge label="Suspendu" tone="danger" /> : <Badge label="Actif" tone="success" />}
        </div>
        {user.isSuspended && user.suspendedReason ? (
          <p className="rounded-lg bg-danger-light p-3 text-sm text-danger-dark">Motif : {user.suspendedReason}</p>
        ) : null}
      </Card>

      {user.accountType === 'SUPPORT' || user.accountType === 'SUPERADMIN' ? (
        <UserRolesSection userId={user.id} />
      ) : null}

      <Card className="space-y-4">
        {user.isSuspended ? (
          <Button variant="success" onClick={() => unsuspendUser.mutate()} loading={unsuspendUser.isPending}>
            Réactiver le compte
          </Button>
        ) : (
          <>
            <TextArea
              label="Motif de la suspension"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison de cette suspension…"
            />
            {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
            <Button variant="danger" onClick={handleSuspend} loading={suspendUser.isPending}>
              Suspendre le compte
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
