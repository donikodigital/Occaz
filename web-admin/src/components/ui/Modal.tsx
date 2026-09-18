// web-admin/src/components/ui/Modal.tsx
'use client';

import React, { useEffect } from 'react';
import { IconX } from '@tabler/icons-react';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Permet d'empiler un modal par-dessus un autre (ex: fiche pays ouverte depuis la liste des statuts). */
  zIndex?: number;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
};

/**
 * Modal générique pour tout le back-office — centré sur tous les écrans.
 * Le calque extérieur est lui-même scrollable (overflow-y-auto) en secours :
 * si le contenu dépasse la hauteur de l'écran (clavier mobile ouvert, très
 * petit viewport), on peut toujours faire défiler jusqu'au bouton du pied de
 * page plutôt qu'il ne soit inatteignable. Pas d'ombre (cohérence avec Card).
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', zIndex = 50 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 overflow-y-auto p-4" style={{ zIndex }} role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      <div className="relative flex min-h-full items-center justify-center">
        <div
          className={`relative flex max-h-[calc(100dvh-2rem)] w-full flex-col overflow-hidden rounded-2xl border border-border bg-surface animate-in zoom-in-95 fade-in ${SIZE_CLASSES[size]}`}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold text-text-primary">{title}</h3>
              {description ? <p className="mt-0.5 truncate text-sm text-text-secondary">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-muted hover:text-text-primary"
              aria-label="Fermer"
            >
              <IconX size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer ? (
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-4">{footer}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}