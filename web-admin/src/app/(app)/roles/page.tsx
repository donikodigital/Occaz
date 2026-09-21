// web-admin/src/app/(app)/roles/page.tsx
//
// v2 — Refonte complète : plus de tableau. Une carte ombrée par rôle :
// nom, clé technique, description, jauge « 10 permissions sur 37 » et les
// domaines qu'il couvre (Trajets, Litiges…). Le rôle qui les a toutes est
// signalé « Accès complet ». La liste est triée du plus large au plus étroit.

'use client';

import React from 'react';
import Link from 'next/link';
import { IconChevronRight, IconPlus, IconShieldCheck } from '@tabler/icons-react';
import { Chip, EmptyState, LinkButton, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { MeterBar, domainLabel, domainOf, permissionKeysOf } from '@/components/roles/RoleForm';
import { usePermissionsCatalog, useRoles } from '@/hooks/useRbac';

type RoleItem = NonNullable<ReturnType<typeof useRoles>['data']>[number];

const MAX_DOMAIN_CHIPS = 4;

function RoleCard({ role, catalogSize }: { role: RoleItem; catalogSize: number }) {
  const count = role.permissions.length;
  const domains = [...new Set(permissionKeysOf(role).map(domainOf))].sort((a, b) => domainLabel(a).localeCompare(domainLabel(b)));
  const hasEverything = catalogSize > 0 && count >= catalogSize;

  return (
    <Link
      href={`/roles/${role.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
          <IconShieldCheck size={22} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{role.name}</p>
          <p className="truncate font-mono text-[11px] text-text-muted">{role.key}</p>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      {role.description ? <p className="text-sm text-text-secondary">{role.description}</p> : null}

      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm text-text-secondary">
            <span className="text-xl font-bold text-text-primary">{count}</span>{' '}
            {count > 1 ? 'permissions' : 'permission'}
            {catalogSize > 0 ? ` sur ${catalogSize}` : ''}
          </p>
          {hasEverything ? <Chip tone="accent">Accès complet</Chip> : null}
        </div>
        {catalogSize > 0 ? <MeterBar value={count} max={catalogSize} /> : null}
      </div>

      {domains.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {domains.slice(0, MAX_DOMAIN_CHIPS).map((domain) => (
            <Chip key={domain} tone="neutral">
              {domainLabel(domain)}
            </Chip>
          ))}
          {domains.length > MAX_DOMAIN_CHIPS ? <Chip tone="primary">+{domains.length - MAX_DOMAIN_CHIPS}</Chip> : null}
        </div>
      ) : null}
    </Link>
  );
}

export default function RolesPage() {
  const { data: roles, isLoading, isError } = useRoles();
  const { data: permissions } = usePermissionsCatalog();

  const catalogSize = permissions?.length ?? 0;
  const sorted = [...(roles ?? [])].sort(
    (a, b) => b.permissions.length - a.permissions.length || a.name.localeCompare(b.name),
  );

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Système"
        title="Rôles"
        description="Ce que chaque rôle a le droit de faire. L’attribution d’un rôle à un utilisateur se fait depuis sa fiche."
        stats={[
          { value: roles ? String(sorted.length) : '…', label: sorted.length > 1 ? 'rôles' : 'rôle' },
          { value: permissions ? String(catalogSize) : '…', label: catalogSize > 1 ? 'permissions au catalogue' : 'permission au catalogue' },
        ]}
      />

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Choisis un rôle pour régler ses permissions.</p>
        <LinkButton href="/roles/new" icon={<IconPlus size={16} />}>
          Créer un rôle
        </LinkButton>
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger les rôles.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-44" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<IconShieldCheck size={26} />}
          title="Aucun rôle"
          text="Crée un premier rôle en choisissant ce qu’il a le droit de faire."
          action={<LinkButton href="/roles/new" icon={<IconPlus size={16} />}>Créer un rôle</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {sorted.map((role) => (
            <RoleCard key={role.id} role={role} catalogSize={catalogSize} />
          ))}
        </div>
      )}
    </div>
  );
}