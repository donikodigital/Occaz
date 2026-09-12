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
    <Card className="flex items-start gap-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[tone]}`}>
        <Icon size={20} />
      </div>
      <div>
        <p className="text-sm text-text-secondary">{label}</p>
        <p className="text-2xl font-semibold text-text-primary">{value}</p>
        {sublabel ? <p className="mt-0.5 text-xs text-text-muted">{sublabel}</p> : null}
      </div>
    </Card>
  );
}
