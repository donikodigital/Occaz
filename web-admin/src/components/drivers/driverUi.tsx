// web-admin/src/components/drivers/driverUi.tsx
'use client';

import React, { useState } from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { DRIVER_STATUS_LABELS } from '@/utils/driverLabels';
import type { DriverAccountStatus } from '@/types/drivers.types';

/* ------------------------------------------------------------------ */
/* Palette des statuts chauffeur                                       */
/* Le bleu « Validé » est en valeurs hexadécimales fixes : il ne       */
/* dépend pas de la palette Tailwind du projet.                        */
/* ------------------------------------------------------------------ */

type DriverStatusStyle = {
  pill: string;
  dot: string;
  banner: string;
  glow: string;
  hoverGlow: string;
};

const DEFAULT_STATUS_STYLE: DriverStatusStyle = {
  pill: 'bg-slate-100 text-slate-700 ring-slate-200',
  dot: 'bg-slate-400',
  banner: 'from-slate-500 to-slate-700',
  glow: 'shadow-slate-500/30',
  hoverGlow: 'hover:shadow-slate-500/25',
};

const STATUS_STYLES: { [key: string]: DriverStatusStyle } = {
  VALIDATED: {
    pill: 'bg-[#e6f1fa] text-[#0a4a7d] ring-[#9fc8e8]',
    dot: 'bg-[#0b6aa8]',
    banner: 'from-[#0b62a3] via-[#0a4a7d] to-[#083a63]',
    glow: 'shadow-[#0a4a7d]/40',
    hoverGlow: 'hover:shadow-[#0a4a7d]/30',
  },
  PENDING: {
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    banner: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/30',
    hoverGlow: 'hover:shadow-amber-500/25',
  },
  IN_VERIFICATION: {
    pill: 'bg-violet-50 text-violet-800 ring-violet-200',
    dot: 'bg-violet-500',
    banner: 'from-violet-500 to-purple-700',
    glow: 'shadow-violet-500/30',
    hoverGlow: 'hover:shadow-violet-500/25',
  },
  SUSPENDED: {
    pill: 'bg-rose-50 text-rose-700 ring-rose-200',
    dot: 'bg-rose-500',
    banner: 'from-rose-500 to-red-600',
    glow: 'shadow-rose-500/30',
    hoverGlow: 'hover:shadow-rose-500/25',
  },
};

export function driverStatusStyle(status: string): DriverStatusStyle {
  return STATUS_STYLES[status] ?? DEFAULT_STATUS_STYLE;
}

export function DriverStatusPill({ status, onDark = false }: { status: DriverAccountStatus; onDark?: boolean }) {
  const style = driverStatusStyle(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        onDark ? 'bg-white/20 text-white ring-white/40 backdrop-blur-sm' : style.pill
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${onDark ? 'bg-white' : style.dot}`} />
      {DRIVER_STATUS_LABELS[status]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

/** Champs facultatifs : affichés seulement si l'API les renvoie. */
export type DriverExtras = {
  createdAt?: string | null;
  completedTripsCount?: number | null;
  completedShipmentsCount?: number | null;
  ratingsCount?: number | null;
};

export function driverExtras(driver: object): DriverExtras {
  return driver as DriverExtras;
}

/* ------------------------------------------------------------------ */
/* Avatar (photo avec repli sur les initiales)                         */
/* ------------------------------------------------------------------ */

const AVATAR_SIZES = {
  sm: 'h-10 w-10 text-sm',
  md: 'h-14 w-14 text-lg',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const;

type DriverAvatarProps = {
  firstName: string;
  lastName: string;
  photoUrl?: string | null;
  size?: keyof typeof AVATAR_SIZES;
  className?: string;
  onPhotoError?: () => void;
};

export function DriverAvatar({
  firstName,
  lastName,
  photoUrl,
  size = 'md',
  className = '',
  onPhotoError,
}: DriverAvatarProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showPhoto = Boolean(photoUrl) && failedUrl !== photoUrl;
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const base = `${AVATAR_SIZES[size]} shrink-0 overflow-hidden rounded-full shadow-lg ring-4 ring-white ${className}`;

  if (showPhoto && photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt=""
        onError={() => {
          setFailedUrl(photoUrl);
          if (onPhotoError) onPhotoError();
        }}
        className={`${base} object-cover`}
      />
    );
  }

  return (
    <span
      className={`${base} inline-grid place-items-center bg-gradient-to-br from-indigo-500 to-violet-600 font-extrabold text-white`}
    >
      {initials}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

const TONE_BUTTON_VARIANTS = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40',
  success:
    'bg-gradient-to-r from-[#0b6aa8] to-[#0a4a7d] text-white shadow-lg shadow-[#0a4a7d]/30 hover:shadow-xl hover:shadow-[#0a4a7d]/40',
  danger:
    'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-lg shadow-rose-500/30 hover:shadow-xl hover:shadow-rose-500/40',
  softDanger: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-100 hover:shadow-md',
  secondary:
    'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:shadow-md',
  ghost: 'bg-transparent text-slate-600 hover:bg-slate-100',
} as const;

const TONE_BUTTON_SIZES = {
  md: 'px-5 py-3 text-sm',
  sm: 'px-3.5 py-2 text-xs',
  // Compact sur mobile pour tenir à deux boutons par ligne, normal dès sm.
  fluid: 'px-2.5 py-2.5 text-xs sm:px-5 sm:py-3 sm:text-sm',
} as const;

type ToneButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'> & {
  variant?: keyof typeof TONE_BUTTON_VARIANTS;
  size?: keyof typeof TONE_BUTTON_SIZES;
  loading?: boolean;
  icon?: React.ReactNode;
  className?: string;
};

export function ToneButton({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  disabled,
  children,
  className = '',
  ...props
}: ToneButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-bold transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 ${TONE_BUTTON_SIZES[size]} ${TONE_BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading ? <IconLoader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Tuile de statistique                                                */
/* ------------------------------------------------------------------ */

const TILE_TONES = {
  indigo: { box: 'bg-indigo-50/60 ring-indigo-100', icon: 'from-indigo-500 to-violet-600 shadow-indigo-500/30' },
  sky: { box: 'bg-sky-50/60 ring-sky-100', icon: 'from-sky-500 to-blue-600 shadow-sky-500/30' },
  rose: { box: 'bg-rose-50/60 ring-rose-100', icon: 'from-rose-500 to-red-600 shadow-rose-500/30' },
  amber: { box: 'bg-amber-50/60 ring-amber-100', icon: 'from-amber-400 to-orange-500 shadow-amber-500/30' },
} as const;

type StatTileProps = {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone: keyof typeof TILE_TONES;
};

export function StatTile({ icon, label, value, hint, tone }: StatTileProps) {
  const style = TILE_TONES[tone];
  return (
    <div className={`flex items-center gap-3 rounded-2xl p-3 ring-1 ring-inset ${style.box}`}>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md ${style.icon}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xl font-extrabold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-xs font-semibold text-slate-500">{label}</p>
        {hint ? <p className="text-[11px] text-slate-400">{hint}</p> : null}
      </div>
    </div>
  );
}