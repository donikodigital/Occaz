// web-admin/src/components/ui/EntityListCard.tsx
'use client';

import React from 'react';
import { IconChevronRight } from '@tabler/icons-react';

export interface EntityListCardProps {
  avatar: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badges?: React.ReactNode;
  onClick: () => void;
}

/** Carte cliquable pour une liste — remplace une ligne de table pour éliminer tout défilement horizontal sur mobile. */
export function EntityListCard({ avatar, title, subtitle, badges, onClick }: EntityListCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-primary-light/20"
    >
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{title}</p>
        {subtitle ? <p className="truncate text-sm text-text-secondary">{subtitle}</p> : null}
        {badges ? <div className="mt-1.5 flex flex-wrap gap-1.5">{badges}</div> : null}
      </div>
      <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}