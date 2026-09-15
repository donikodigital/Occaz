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
    <Card className="flex flex-col gap-2.5 p-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-full ${TONE_CLASSES[tone]}`}>
        <Icon size={19} />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-text-secondary">{label}</p>
        <p className="text-2xl font-semibold leading-tight tracking-tight text-text-primary tabular-nums">
          {value}
        </p>
        {sublabel ? <p className="truncate text-xs text-text-muted">{sublabel}</p> : null}
      </div>
    </Card>
  );
}