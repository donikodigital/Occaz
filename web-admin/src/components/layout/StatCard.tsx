// web-admin/src/components/layout/StatCard.tsx
import React from 'react';
import { Card } from '@/components/ui';

export interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  sublabel?: string;
  tone?: 'primary' | 'success' | 'accent' | 'danger';
}

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, { chip: string; bar: string }> = {
  primary: { chip: 'bg-primary-light text-primary-dark', bar: 'bg-primary' },
  success: { chip: 'bg-success-light text-success-dark', bar: 'bg-success' },
  accent: { chip: 'bg-accent-light text-accent-dark', bar: 'bg-accent' },
  danger: { chip: 'bg-danger-light text-danger-dark', bar: 'bg-danger' },
};

export function StatCard({ label, value, icon: Icon, sublabel, tone = 'primary' }: StatCardProps) {
  const tones = TONE_CLASSES[tone];
  return (
    <Card padded={false} className="relative overflow-hidden">
      {/* Liseré de couleur qui code la catégorie de la métrique, sans ombre ni dégradé. */}
      <span className={`absolute inset-y-0 left-0 w-[3px] ${tones.bar}`} aria-hidden="true" />
      <div className="flex items-start gap-4 p-5 pl-6">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${tones.chip}`}>
          <Icon size={20} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="text-[28px] font-semibold leading-tight tracking-tight text-text-primary tabular-nums">
            {value}
          </p>
          {sublabel ? <p className="mt-0.5 truncate text-xs text-text-muted">{sublabel}</p> : null}
        </div>
      </div>
    </Card>
  );
}