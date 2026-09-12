// web-admin/src/app/(app)/roles/new/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { IconArrowLeft } from '@tabler/icons-react';
import { Button, Card, TextField } from '@/components/ui';
import { useCreateRole, usePermissionsCatalog } from '@/hooks/useRbac';
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

export default function NewRolePage() {
  const router = useRouter();
  const { data: permissions } = usePermissionsCatalog();
  const createRole = useCreateRole();

  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const grouped = useMemo(() => groupByDomain((permissions ?? []).map((p) => p.key)), [permissions]);

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

    if (!/^[a-z0-9_]+$/.test(key)) {
      setErrorMessage('La clé doit être en snake_case minuscule (ex: support_supervisor).');
      return;
    }
    if (name.trim().length < 2) {
      setErrorMessage('Renseignez un nom.');
      return;
    }

    try {
      const role = await createRole.mutateAsync({
        key,
        name: name.trim(),
        description: description.trim() || undefined,
        permissionKeys: Array.from(selectedKeys),
      });
      router.replace(`/roles/${role.id}`);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/roles" className="text-text-secondary hover:text-text-primary">
          <IconArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-semibold text-text-primary">Créer un rôle</h1>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Clé (snake_case)" value={key} onChange={(e) => setKey(e.target.value)} placeholder="support_agent" required />
            <TextField label="Nom affiché" value={name} onChange={(e) => setName(e.target.value)} placeholder="Agent clientèle" required />
          </div>
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

          <Button type="submit" loading={createRole.isPending}>
            Créer le rôle
          </Button>
        </form>
      </Card>
    </div>
  );
}
