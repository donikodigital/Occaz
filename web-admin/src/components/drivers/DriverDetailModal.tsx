// web-admin/src/components/drivers/DriverDetailModal.tsx
'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { DisputeMotionStyles, disputeFont } from '@/components/disputes/disputeUi';
import { DriverProfile } from './DriverProfile';

export interface DriverDetailModalProps {
  open: boolean;
  onClose: () => void;
  driverId: string | null;
}

export function DriverDetailModal({ open, onClose, driverId }: DriverDetailModalProps) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || driverId === null || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`${disputeFont.className} fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6`}
      role="dialog"
      aria-modal="true"
      aria-label="Fiche chauffeur"
    >
      <DisputeMotionStyles />
      <style>{`
        @keyframes driver-overlay-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes driver-sheet-in {
          from { opacity: 0; transform: translateY(40px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .driver-overlay { animation: driver-overlay-in 0.25s ease-out backwards; }
        .driver-sheet { animation: driver-sheet-in 0.35s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
        @media (prefers-reduced-motion: reduce) {
          .driver-overlay, .driver-sheet { animation: none; }
        }
      `}</style>

      <div className="driver-overlay absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      <div className="driver-sheet relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-3xl bg-slate-50 shadow-2xl ring-1 ring-slate-900/10 sm:max-w-2xl sm:rounded-3xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/70 bg-white px-5 py-3.5">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Fiche chauffeur</p>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label="Fermer"
            className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 active:scale-95"
          >
            <IconX size={18} />
          </button>
        </div>

        <div className="overflow-y-auto overscroll-contain p-4 sm:p-5">
          <DriverProfile key={driverId} driverId={driverId} showFullPageLink />
        </div>
      </div>
    </div>,
    document.body,
  );
}