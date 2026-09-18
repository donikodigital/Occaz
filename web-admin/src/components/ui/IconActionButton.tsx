// web-admin/src/components/ui/IconActionButton.tsx
'use client';

import React from 'react';
import { IconLoader2 } from '@tabler/icons-react';

export type IconActionTone = 'neutral' | 'success' | 'danger';

export interface IconActionButtonProps {
  icon: React.ComponentType<{ size?: number }>;
  /** Obligatoire : seul repère accessible puisqu'il n'y a pas de texte visible. */
  label: string;
  onClick?: () => void;
  tone?: IconActionTone;
  loading?: boolean;
  disabled?: boolean;
}

const TONE_CLASSES: Record<IconActionTone, string> = {
  neutral: 'border border-border bg-surface text-text-secondary hover:bg-surface-muted',
  success: 'bg-success text-white hover:brightness-95',
  danger: 'border border-danger bg-surface text-danger hover:bg-danger-light',
};

/** Bouton d'action compact (icône + aria-label, pas de texte) — pour les rangées d'actions denses (documents, véhicules) où des boutons texte débordent sur mobile. */
export function IconActionButton({ icon: Icon, label, onClick, tone = 'neutral', loading, disabled }: IconActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={label}
      title={label}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:opacity-50 ${TONE_CLASSES[tone]}`}
    >
      {loading ? <IconLoader2 size={15} className="animate-spin" /> : <Icon size={15} />}
    </button>
  );
}