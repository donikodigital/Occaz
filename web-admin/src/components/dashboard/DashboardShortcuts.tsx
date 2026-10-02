// web-admin/src/components/dashboard/DashboardShortcuts.tsx
// [02/10/2026] v+ — Chaque raccourci n'apparaît que si le compte a la permission de la page visée.
'use client';

import React from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconSteeringWheel, IconUsers, IconWorld } from '@tabler/icons-react';
import { usePermissions } from '@/hooks/usePermissions';
import { PERMISSIONS, type PermissionKey } from '@/utils/permissions';

const SHORTCUTS: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  tone: 'primary' | 'danger' | 'accent' | 'success';
  permission: PermissionKey;
}[] = [
  { href: '/drivers', label: 'Chauffeurs', icon: IconSteeringWheel, tone: 'primary', permission: PERMISSIONS.DRIVER_READ },
  { href: '/disputes', label: 'Litiges', icon: IconAlertTriangle, tone: 'danger', permission: PERMISSIONS.DISPUTE_READ },
  { href: '/users', label: 'Utilisateurs', icon: IconUsers, tone: 'accent', permission: PERMISSIONS.USER_READ },
  { href: '/geography', label: 'Géographie', icon: IconWorld, tone: 'success', permission: PERMISSIONS.GEOGRAPHY_MANAGE },
];

const TONE_CLASSES: Record<(typeof SHORTCUTS)[number]['tone'], { icon: string; shadow: string }> = {
  primary: { icon: 'bg-primary-light text-primary', shadow: 'shadow-primary-dark/15' },
  danger: { icon: 'bg-danger-light text-danger-dark', shadow: 'shadow-danger-dark/15' },
  accent: { icon: 'bg-accent-light text-accent-dark', shadow: 'shadow-accent-dark/15' },
  success: { icon: 'bg-success-light text-success-dark', shadow: 'shadow-success-dark/15' },
};

/** Accès rapides — icône ronde ombrée qui se soulève légèrement au survol. */
export function DashboardShortcuts() {
  const { can } = usePermissions();
  const visible = SHORTCUTS.filter((shortcut) => can(shortcut.permission));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold text-text-secondary">Raccourcis</h2>
      <div className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map(({ href, label, icon: Icon, tone }) => (
          <Link key={href} href={href} className="group flex flex-col items-center gap-2 text-center">
            <span
              className={`flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-md sm:h-14 sm:w-14 ${TONE_CLASSES[tone].icon} ${TONE_CLASSES[tone].shadow}`}
            >
              <Icon size={20} />
            </span>
            <span className="text-[11px] font-medium leading-tight text-text-primary sm:text-xs">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}