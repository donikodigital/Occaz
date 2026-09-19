// web-admin/src/components/dashboard/DashboardShortcuts.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconSteeringWheel, IconUsers, IconWorld } from '@tabler/icons-react';

const SHORTCUTS = [
  { href: '/drivers', label: 'Chauffeurs', icon: IconSteeringWheel, tone: 'primary' as const },
  { href: '/disputes', label: 'Litiges', icon: IconAlertTriangle, tone: 'danger' as const },
  { href: '/users', label: 'Utilisateurs', icon: IconUsers, tone: 'accent' as const },
  { href: '/geography', label: 'Géographie', icon: IconWorld, tone: 'success' as const },
];

const TONE_CLASSES: Record<(typeof SHORTCUTS)[number]['tone'], { icon: string; shadow: string }> = {
  primary: { icon: 'bg-primary-light text-primary', shadow: 'shadow-primary-dark/15' },
  danger: { icon: 'bg-danger-light text-danger-dark', shadow: 'shadow-danger-dark/15' },
  accent: { icon: 'bg-accent-light text-accent-dark', shadow: 'shadow-accent-dark/15' },
  success: { icon: 'bg-success-light text-success-dark', shadow: 'shadow-success-dark/15' },
};

/** Accès rapides — icône ronde ombrée qui se soulève légèrement au survol. */
export function DashboardShortcuts() {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <h2 className="mb-4 text-sm font-semibold text-text-secondary">Raccourcis</h2>
      <div className="grid grid-cols-4 gap-2 sm:gap-4">
        {SHORTCUTS.map(({ href, label, icon: Icon, tone }) => (
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