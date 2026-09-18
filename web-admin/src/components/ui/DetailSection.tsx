// web-admin/src/components/ui/DetailSection.tsx
import React from 'react';

export interface DetailSectionProps {
  title: string;
  children: React.ReactNode;
  columns?: 2 | 3;
}

/** En-tête de section coloré + grille de champs — pour le corps des modals de détail. */
export function DetailSection({ title, children, columns = 2 }: DetailSectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="border-b border-border pb-1.5 text-xs font-bold uppercase tracking-wide text-primary">{title}</h4>
      <div className={`grid gap-x-4 gap-y-3 ${columns === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2'}`}>{children}</div>
    </div>
  );
}

export function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-0.5 truncate text-sm font-medium text-text-primary">{value}</p>
    </div>
  );
}