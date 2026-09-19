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

const TONE_CLASSES: Record<NonNullable<StatCardProps['tone']>, { icon: string; shadow: string }> = {
  primary: { icon: 'bg-primary-light text-primary-dark', shadow: 'shadow-primary-dark/10' },
  success: { icon: 'bg-success-light text-success-dark', shadow: 'shadow-success-dark/10' },
  accent: { icon: 'bg-accent-light text-accent-dark', shadow: 'shadow-accent-dark/10' },
  danger: { icon: 'bg-danger-light text-danger-dark', shadow: 'shadow-danger-dark/10' },
};

/** Densifiée pour tenir 3 par ligne dès mobile — icône et police réduites au plus petit breakpoint. */
export function StatCard({ label, value, icon: Icon, sublabel, tone = 'primary' }: StatCardProps) {
  const { icon, shadow } = TONE_CLASSES[tone];
  return (
    <Card className={`group flex flex-col gap-2 rounded-xl p-2.5 ${shadow} transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg sm:gap-3 sm:rounded-2xl sm:p-4`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110 sm:h-11 sm:w-11 sm:rounded-xl ${icon}`}>
        <Icon size={16} className="sm:hidden" />
        <Icon size={21} className="hidden sm:block" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-[10px] leading-tight text-text-secondary sm:text-sm">{label}</p>
        <p className="text-lg font-bold leading-tight tracking-tight text-text-primary tabular-nums sm:text-[28px]">
          {value}
        </p>
        {sublabel ? <p className="truncate text-[9px] leading-tight text-text-muted sm:text-xs">{sublabel}</p> : null}
      </div>
    </Card>
  );
}