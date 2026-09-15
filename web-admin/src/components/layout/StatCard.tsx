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

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, string> = {
  primary: 'bg-primary-light text-primary-dark',
  success: 'bg-success-light text-success-dark',
  accent: 'bg-accent-light text-accent-dark',
  danger: 'bg-danger-light text-danger-dark',
};

export function StatCard({ label, value, icon: Icon, sublabel, tone = 'primary' }: StatCardProps) {
  return (
    <Card className="flex flex-col gap-2 p-3 sm:p-4">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10 ${TONE_CLASSES[tone]}`}
      >
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs text-text-secondary sm:text-sm">{label}</p>
        <p className="text-xl font-semibold leading-tight tracking-tight text-text-primary tabular-nums sm:text-2xl">
          {value}
        </p>
        {sublabel ? <p className="truncate text-[11px] text-text-muted sm:text-xs">{sublabel}</p> : null}
      </div>
    </Card>
  );
}