// web-admin/src/components/platformWallet/ExpenseParts.tsx
// [25/10/2026] v1 — Petits éléments partagés par le portefeuille de la plateforme et la comptabilité : icône et pastille d'un motif, pastille
// de statut d'un retrait, bouton « PDF » qui télécharge la pièce comptable.
'use client';

import React from 'react';
import {
  IconCheck,
  IconClockHour4,
  IconDeviceDesktop,
  IconDots,
  IconFileTypePdf,
  IconGift,
  IconNotebook,
  IconPlaneDeparture,
  IconReceipt2,
  IconBolt,
  IconX,
} from '@tabler/icons-react';
import { Button } from '@/components/ui';
import { IconTile, type Tone } from '@/components/admin/AdminUi';
import { useDownloadDocument } from '@/hooks/useAccounting';
import { ApiError } from '@/services/api/ApiError';
import { documentNeedsManage } from '@/utils/expenseCategories';
import type { ExpenseCategory, PlatformWithdrawal, PlatformWithdrawalStatus } from '@/types/platform-wallet.types';

export const EXPENSE_ICONS: Record<ExpenseCategory, React.ReactNode> = {
  SALARY: <IconReceipt2 size={20} />,
  BONUS: <IconGift size={20} />,
  OPERATING: <IconBolt size={20} />,
  TRAVEL: <IconPlaneDeparture size={20} />,
  SUPPLIES: <IconNotebook size={20} />,
  OFFICE_EQUIPMENT: <IconDeviceDesktop size={20} />,
  OTHER: <IconDots size={20} />,
};

export const EXPENSE_TONES: Record<ExpenseCategory, Tone> = {
  SALARY: 'primary',
  BONUS: 'accent',
  OPERATING: 'neutral',
  TRAVEL: 'primary',
  SUPPLIES: 'success',
  OFFICE_EQUIPMENT: 'success',
  OTHER: 'neutral',
};

export function ExpenseIcon({ category }: { category: ExpenseCategory }) {
  return <IconTile tone={EXPENSE_TONES[category]}>{EXPENSE_ICONS[category]}</IconTile>;
}

const STATUS_LABELS: Record<PlatformWithdrawalStatus, string> = { PROCESSING: 'En cours', PAID: 'Payé', FAILED: 'Échoué' };

/** Pastille de statut : toujours sur une seule ligne. */
export function StatusPill({ status }: { status: PlatformWithdrawalStatus }) {
  const classes: Record<PlatformWithdrawalStatus, string> = {
    PROCESSING: 'bg-primary-light text-primary',
    PAID: 'bg-success-light text-success-dark',
    FAILED: 'bg-danger-light text-danger-dark',
  };
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${classes[status]}`}>
      {status === 'PROCESSING' ? <IconClockHour4 size={13} /> : status === 'PAID' ? <IconCheck size={13} /> : <IconX size={13} />}
      {STATUS_LABELS[status]}
    </span>
  );
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date);
}

/**
 * Télécharge la pièce du retrait en PDF. Absent pour un retrait d'avant les motifs (pas de pièce) ; les bulletins et reçus de prime ne
 * s'offrent qu'à ceux qui gèrent le portefeuille (le serveur le vérifie aussi).
 */
export function DocumentButton({ withdrawal, canManage }: { withdrawal: PlatformWithdrawal; canManage: boolean }) {
  const download = useDownloadDocument();
  if (!withdrawal.hasDocument) return null;
  if (documentNeedsManage(withdrawal.category) && !canManage) return null;
  const error = download.error ? (download.error instanceof ApiError ? download.error.message : 'Le téléchargement a échoué.') : null;
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="secondary"
        className="!px-3 !py-1.5 !text-xs"
        loading={download.isPending}
        onClick={() => download.mutate({ id: withdrawal.id, documentNumber: withdrawal.documentNumber })}
      >
        <IconFileTypePdf size={15} />
        Télécharger le PDF
      </Button>
      {error ? <p className="max-w-[16rem] text-right text-xs text-danger">{error}</p> : null}
    </div>
  );
}
