// web-admin/src/components/ui/TintedIconButton.tsx
'use client';

import React from 'react';
import { IconLoader2 } from '@tabler/icons-react';

export type TintedIconTone = 'primary' | 'accent' | 'success' | 'danger' | 'neutral';

const TONE_CLASSES: Record<TintedIconTone, string> = {
  primary: 'bg-primary-light text-primary hover:brightness-95',
  accent: 'bg-accent-light text-accent-dark hover:brightness-95',
  success: 'bg-success-light text-success-dark hover:brightness-95',
  danger: 'bg-danger-light text-danger-dark hover:brightness-95',
  neutral: 'bg-surface-muted text-text-secondary hover:brightness-95',
};

export interface TintedIconButtonProps {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  onClick?: () => void;
  tone?: TintedIconTone;
  loading?: boolean;
  disabled?: boolean;
}

/** Bouton d'action carré à fond pastel — rangée d'actions en tête d'un modal de détail (Modifier/Voir/Suspendre/Supprimer), inspiré du design LCD. */
export function TintedIconButton({ icon: Icon, label, onClick, tone = 'neutral', loading, disabled }: TintedIconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-all disabled:opacity-50 ${TONE_CLASSES[tone]}`}
    >
      {loading ? <IconLoader2 size={18} className="animate-spin" /> : <Icon size={18} />}
    </button>
  );
}