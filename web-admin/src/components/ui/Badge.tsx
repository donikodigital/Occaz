// web-admin/src/components/ui/Badge.tsx
import React from 'react';

export type BadgeTone = 'primary' | 'success' | 'accent' | 'danger' | 'neutral';

const TONE_CLASSES: Record<BadgeTone, string> = {
  primary: 'bg-primary-light text-primary-dark',
  success: 'bg-success-light text-success-dark',
  accent: 'bg-accent-light text-accent-dark',
  danger: 'bg-danger-light text-danger-dark',
  neutral: 'bg-surface-muted text-text-secondary',
};

export interface BadgeProps {
  label: string;
  tone?: BadgeTone;
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}>
      {label}
    </span>
  );
}
