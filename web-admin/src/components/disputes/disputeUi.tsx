// web-admin/src/components/disputes/disputeUi.tsx
import React from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { IconChevronDown, IconFlag, IconLoader2 } from '@tabler/icons-react';
import { DISPUTE_PRIORITY_LABELS, DISPUTE_STATUS_LABELS } from '@/utils/disputeLabels';
import type { DisputePriority, DisputeStatus } from '@/types/disputes.types';

/* ------------------------------------------------------------------ */
/* Police                                                              */
/* ------------------------------------------------------------------ */

export const disputeFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  display: 'swap',
});

/* ------------------------------------------------------------------ */
/* Palettes                                                            */
/* ------------------------------------------------------------------ */

type StatusStyle = {
  pill: string;
  dot: string;
  gradient: string;
  glow: string;
};

type PriorityStyle = {
  pill: string;
  bar: string;
};

export const STATUS_STYLE: { [key in DisputeStatus]: StatusStyle } = {
  OPENED: {
    pill: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500',
    gradient: 'from-sky-500 to-blue-600',
    glow: 'shadow-sky-500/30',
  },
  UNDER_REVIEW: {
    pill: 'bg-indigo-50 text-indigo-700 ring-indigo-200',
    dot: 'bg-indigo-500',
    gradient: 'from-indigo-500 to-violet-600',
    glow: 'shadow-indigo-500/30',
  },
  WAITING_FOR_CUSTOMER: {
    pill: 'bg-amber-50 text-amber-800 ring-amber-200',
    dot: 'bg-amber-500',
    gradient: 'from-amber-400 to-orange-500',
    glow: 'shadow-amber-500/30',
  },
  WAITING_FOR_DRIVER: {
    pill: 'bg-orange-50 text-orange-800 ring-orange-200',
    dot: 'bg-orange-500',
    gradient: 'from-orange-500 to-red-500',
    glow: 'shadow-orange-500/30',
  },
  INVESTIGATION: {
    pill: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200',
    dot: 'bg-fuchsia-500',
    gradient: 'from-fuchsia-500 to-purple-600',
    glow: 'shadow-fuchsia-500/30',
  },
  RESOLVED: {
    pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    dot: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-600',
    glow: 'shadow-emerald-500/30',
  },
  CLOSED: {
    pill: 'bg-slate-100 text-slate-700 ring-slate-200',
    dot: 'bg-slate-400',
    gradient: 'from-slate-500 to-slate-700',
    glow: 'shadow-slate-500/30',
  },
};

export const PRIORITY_STYLE: { [key in DisputePriority]: PriorityStyle } = {
  LOW: {
    pill: 'bg-slate-100 text-slate-600 ring-slate-200',
    bar: 'from-slate-300 to-slate-400',
  },
  MEDIUM: {
    pill: 'bg-blue-50 text-blue-700 ring-blue-200',
    bar: 'from-blue-400 to-indigo-500',
  },
  HIGH: {
    pill: 'bg-orange-50 text-orange-700 ring-orange-200',
    bar: 'from-orange-400 to-red-500',
  },
  CRITICAL: {
    pill: 'bg-rose-50 text-rose-700 ring-rose-200',
    bar: 'from-rose-500 to-red-600',
  },
};

/* ------------------------------------------------------------------ */
/* Animations (keyframes embarquées, aucune config Tailwind requise)   */
/* ------------------------------------------------------------------ */

export function DisputeMotionStyles() {
  return (
    <style>{`
      @keyframes dispute-fade-up {
        from { opacity: 0; transform: translateY(14px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes dispute-pop {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
      .dispute-fade-up { animation: dispute-fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
      .dispute-pop { animation: dispute-pop 0.4s cubic-bezier(0.22, 1, 0.36, 1) backwards; }
      @media (prefers-reduced-motion: reduce) {
        .dispute-fade-up, .dispute-pop { animation: none; }
      }
    `}</style>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export function disputeRef(id: string) {
  return `#${id.slice(0, 6).toUpperCase()}`;
}

export function initialOf(label: string) {
  return (label.trim().charAt(0) || '?').toUpperCase();
}

/* ------------------------------------------------------------------ */
/* Pastilles                                                           */
/* ------------------------------------------------------------------ */

export function StatusPill({ status, onDark = false }: { status: DisputeStatus; onDark?: boolean }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        onDark ? 'bg-white/15 text-white ring-white/30 backdrop-blur-sm' : style.pill
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${onDark ? 'bg-white' : style.dot}`} />
      {DISPUTE_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityPill({ priority, onDark = false }: { priority: DisputePriority; onDark?: boolean }) {
  const style = PRIORITY_STYLE[priority];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${
        onDark ? 'bg-white/15 text-white ring-white/30 backdrop-blur-sm' : style.pill
      }`}
    >
      <IconFlag size={12} />
      {DISPUTE_PRIORITY_LABELS[priority]}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Panneau (carte de section)                                          */
/* ------------------------------------------------------------------ */

type PanelProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  className?: string;
};

export function Panel({ title, icon, children, delay = 0, className = '' }: PanelProps) {
  return (
    <section
      className={`dispute-fade-up rounded-2xl bg-white p-5 shadow-lg shadow-slate-900/10 ring-1 ring-slate-900/5 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-50 to-violet-100 text-indigo-600 ring-1 ring-inset ring-indigo-100">
          {icon}
        </span>
        <h2 className="text-base font-bold text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Champs de formulaire                                                */
/* ------------------------------------------------------------------ */

const LABEL_CLASS = 'mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500';

export const CONTROL_CLASS =
  'w-full rounded-xl bg-slate-50 px-3.5 py-3 text-sm font-medium text-slate-900 shadow-sm ring-1 ring-inset ring-slate-200 transition placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500 disabled:opacity-60';

type NativeSelectProps = Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'className' | 'children'>;
type NativeInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'>;
type NativeTextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'className'>;
type NativeButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className'>;

type SelectFieldProps = NativeSelectProps & {
  label?: string;
  className?: string;
  children: React.ReactNode;
};

export function SelectField({ label, className = '', children, ...props }: SelectFieldProps) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className={LABEL_CLASS}>{label}</span> : null}
      <span className="relative block">
        <select {...props} className={`${CONTROL_CLASS} appearance-none pr-10`}>
          {children}
        </select>
        <IconChevronDown
          size={16}
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400"
        />
      </span>
    </label>
  );
}

type InputFieldProps = NativeInputProps & {
  label?: string;
  hint?: string;
  className?: string;
};

export function InputField({ label, hint, className = '', ...props }: InputFieldProps) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className={LABEL_CLASS}>{label}</span> : null}
      <input {...props} className={CONTROL_CLASS} />
      {hint ? <span className="mt-1.5 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

type TextAreaFieldProps = NativeTextAreaProps & {
  label?: string;
  className?: string;
};

export function TextAreaField({ label, className = '', ...props }: TextAreaFieldProps) {
  return (
    <label className={`block ${className}`}>
      {label ? <span className={LABEL_CLASS}>{label}</span> : null}
      <textarea {...props} className={`${CONTROL_CLASS} resize-y`} />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Boutons                                                             */
/* ------------------------------------------------------------------ */

const BUTTON_VARIANTS = {
  primary:
    'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/40',
  success:
    'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30 hover:shadow-xl hover:shadow-emerald-500/40',
  secondary:
    'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:shadow-md',
} as const;

type ActionButtonProps = NativeButtonProps & {
  variant?: keyof typeof BUTTON_VARIANTS;
  loading?: boolean;
  className?: string;
};

export function ActionButton({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...props
}: ActionButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0 ${BUTTON_VARIANTS[variant]} ${className}`}
    >
      {loading ? <IconLoader2 size={16} className="animate-spin" /> : null}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Squelette de chargement                                             */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-slate-200/80 ${className}`} />;
}