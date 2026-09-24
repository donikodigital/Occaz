// web-admin/src/components/ui/Button.tsx
'use client';

import React from 'react';
import { IconLoader2 } from '@tabler/icons-react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'outline' | 'ghost' | 'danger';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-ocean text-on-primary shadow-sm shadow-primary-dark/20 hover:brightness-110',
  success: 'bg-success text-white hover:brightness-95',
  danger: 'bg-danger text-white hover:brightness-95',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-surface-muted',
  outline: 'bg-transparent text-primary border border-primary hover:bg-primary-light',
  ghost: 'bg-transparent text-text-primary hover:bg-surface-muted',
};

/** Bouton unique pour tout le back-office — une seule action "primary" par écran. */
export function Button({ variant = 'primary', loading, disabled, className = '', children, ...rest }: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${VARIANT_CLASSES[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <IconLoader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}