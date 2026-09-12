// web-admin/src/app/(app)/roles/[id]/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Button, Card, TextField } from '@/components/ui';
import { useRole, useUpdateRole, usePermissionsCatalog } from '@/hooks/useRbac';
import { ApiError } from '@/services/api/ApiError';

function groupByDomain(keys: string[]): Record<string, string[]> {
  const groups: Record<string, string[]> = {};
  for (const key of keys) {
    const domain = key.split('.')[0] ?? 'autre';
    groups[domain] ??= [];
    groups[domain].push(key);
  }
  return groups;
}

export default function EditRolePage() {
  const { id } = useParams<{ id: string }>();
  const { data: role, isLoading, isError } = useRole(id);
  const { data: permissions } = usePermissionsCatalog();
  const updateRole = useUpdateRole(id);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  const grouped = useMemo(() => groupByDomain((permissions ?? []).map((p) => p.key)), [permissions]);

  useEffect(() => {
    if (!role) return;
    setName(role.name);
    setDescription(role.description ?? '');
    setSelectedKeys(new Set(role.permissions.map((link) => link.permission.key)));
  }, [role]);

  function toggle(permKey: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    setSaved(false);

    try {
      await updateRole.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        permissionKeys: Array.from(selectedKeys),
      });
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  if (isError) return <p className="text-sm text-danger">Rôle introuvable.</p>;
  if (isLoading || !role) return <p className="text-sm text-text-secondary">Chargement…</p>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/roles" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">{role.name}</h1>
          <p className="font-mono text-xs text-text-muted">{role.key}</p>
        </div>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <TextField label="Nom affiché" value={name} onChange={(e) => setName(e.target.value)} required />
          <TextField label="Description (optionnel)" value={description} onChange={(e) => setDescription(e.target.value)} />

          <div>
            <p className="mb-2 text-sm font-medium text-text-secondary">Permissions</p>
            <div className="max-h-96 space-y-4 overflow-y-auto rounded-lg border border-border p-4">
              {Object.entries(grouped).map(([domain, keys]) => (
                <div key={domain}>
                  <p className="mb-1.5 text-xs font-semibold text-text-muted">{domain}</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {keys.map((permKey) => (
                      <label key={permKey} className="flex items-center gap-2 text-sm text-text-primary">
                        <input
                          type="checkbox"
                          checked={selectedKeys.has(permKey)}
                          onChange={() => toggle(permKey)}
                          className="rounded border-border-strong"
                        />
                        {permKey}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
          {saved ? <p className="text-sm text-success-dark">Modifications enregistrées.</p> : null}

          <Button type="submit" loading={updateRole.isPending}>
            Enregistrer les modifications
          </Button>
        </form>
      </Card>
    </div>
  );
}
