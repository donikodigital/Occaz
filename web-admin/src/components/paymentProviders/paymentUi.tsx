// web-admin/src/components/paymentProviders/paymentUi.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconBuildingBank,
  IconCash,
  IconCheck,
  IconCreditCard,
  IconDeviceMobile,
  IconSettings,
  IconShieldLock,
  IconWallet,
} from '@tabler/icons-react';

/* ------------------------------------------------------------------ */
/* Identité visuelle d'un moyen de paiement                            */
/* Reconnue à partir du nom du type (ORANGE_MONEY, CARD, BANK...),     */
/* avec un repli par défaut : un nouveau type ne casse jamais la page. */
/* ------------------------------------------------------------------ */

type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

type ProviderVisual = {
  icon: IconComponent;
  gradient: string;
  glow: string;
};

type VisualRule = {
  match: string[];
  visual: ProviderVisual;
};

const DEFAULT_VISUAL: ProviderVisual = {
  icon: IconWallet,
  gradient: 'from-primary to-primary-dark',
  glow: 'shadow-primary-dark/30',
};

const VISUAL_RULES: VisualRule[] = [
  {
    match: ['ORANGE'],
    visual: { icon: IconDeviceMobile, gradient: 'from-orange-400 to-orange-600', glow: 'shadow-orange-500/30' },
  },
  {
    match: ['MTN'],
    visual: { icon: IconDeviceMobile, gradient: 'from-yellow-400 to-amber-500', glow: 'shadow-amber-500/30' },
  },
  {
    match: ['MOBILE'],
    visual: { icon: IconDeviceMobile, gradient: 'from-sky-500 to-blue-600', glow: 'shadow-sky-500/30' },
  },
  {
    match: ['CARD', 'CARTE', 'STRIPE', 'VISA'],
    visual: { icon: IconCreditCard, gradient: 'from-violet-500 to-purple-700', glow: 'shadow-violet-500/30' },
  },
  {
    match: ['BANK', 'TRANSFER', 'VIREMENT', 'WIRE'],
    visual: { icon: IconBuildingBank, gradient: 'from-slate-600 to-slate-800', glow: 'shadow-slate-600/30' },
  },
  {
    match: ['CASH', 'ESPECES'],
    visual: { icon: IconCash, gradient: 'from-teal-500 to-cyan-600', glow: 'shadow-teal-500/30' },
  },
];

export function providerVisual(type: string): ProviderVisual {
  const key = type.toUpperCase();
  const rule = VISUAL_RULES.find((item) => item.match.some((token) => key.includes(token)));
  return rule ? rule.visual : DEFAULT_VISUAL;
}

const ICON_SIZES = {
  md: { box: 'h-11 w-11 rounded-xl', icon: 22 },
  lg: { box: 'h-14 w-14 rounded-2xl', icon: 28 },
} as const;

type ProviderIconProps = {
  type: string;
  size?: keyof typeof ICON_SIZES;
  onDark?: boolean;
};

export function ProviderIcon({ type, size = 'md', onDark = false }: ProviderIconProps) {
  const visual = providerVisual(type);
  const Icon = visual.icon;
  const sizing = ICON_SIZES[size];
  const surface = onDark
    ? 'bg-white/15 ring-1 ring-inset ring-white/30 backdrop-blur-sm'
    : `bg-gradient-to-br shadow-md ${visual.gradient} ${visual.glow}`;

  return (
    <span className={`grid ${sizing.box} shrink-0 place-items-center text-white ${surface}`}>
      <Icon size={sizing.icon} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export function configKeyCount(config: unknown): number {
  if (typeof config !== 'object' || config === null) return 0;
  return Object.keys(config).length;
}

export function ConfigChip({ config }: { config: unknown }) {
  const count = configKeyCount(config);

  if (count === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
        <IconAlertTriangle size={13} />
        À configurer
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#e6f1fa] px-2 py-1 text-xs font-semibold text-[#0a4a7d] ring-1 ring-inset ring-[#9fc8e8]">
      <IconSettings size={13} />
      Configuré · {count} paramètre{count > 1 ? 's' : ''}
    </span>
  );
}

export function SecurityNote() {
  return (
    <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs font-medium leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-200">
      <IconShieldLock size={16} className="mt-0.5 shrink-0" />
      <span>
        Identifiants publics uniquement (endpoint, identifiant marchand…). Jamais de secret : il reste en variable
        d&apos;environnement côté backend.
      </span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Statut                                                              */
/* ------------------------------------------------------------------ */

export function ActiveBadge({ active, onDark = false }: { active: boolean; onDark?: boolean }) {
  const tone = onDark
    ? 'bg-white/20 text-white ring-white/40 backdrop-blur-sm'
    : active
      ? 'bg-[#e6f1fa] text-[#0a4a7d] ring-[#9fc8e8]'
      : 'bg-slate-100 text-slate-600 ring-slate-200';
  const dot = onDark ? 'bg-white' : active ? 'bg-[#0b6aa8]' : 'bg-slate-400';

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {active ? 'Actif' : 'Inactif'}
    </span>
  );
}

type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
};

export function ToggleSwitch({ checked, onChange, disabled = false, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full shadow-inner transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? 'bg-[#0b6aa8]' : 'bg-slate-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Résumé                                                              */
/* ------------------------------------------------------------------ */

const SUMMARY_TONES = {
  indigo: 'bg-primary-light text-primary-dark ring-primary-accent/40',
  blue: 'bg-[#e6f1fa] text-[#0a4a7d] ring-[#9fc8e8]',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
} as const;

type SummaryTileProps = {
  label: string;
  value: number;
  tone: keyof typeof SUMMARY_TONES;
};

export function SummaryTile({ label, value, tone }: SummaryTileProps) {
  return (
    <div className={`rounded-2xl p-3 text-center shadow-sm ring-1 ring-inset ${SUMMARY_TONES[tone]}`}>
      <p className="text-2xl font-extrabold leading-none">{value}</p>
      <p className="mt-1.5 text-[11px] font-bold uppercase tracking-wide opacity-80">{label}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Choix du type (tuiles)                                              */
/* ------------------------------------------------------------------ */

type TypeOption = { value: string; label: string };

type TypePickerProps = {
  value: string;
  options: TypeOption[];
  onChange: (value: string) => void;
};

export function TypePicker({ value, options, onChange }: TypePickerProps) {
  return (
    <div role="radiogroup" aria-label="Type de moyen de paiement" className="grid grid-cols-2 gap-3">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`relative flex flex-col items-center gap-2.5 rounded-2xl p-4 text-center transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:scale-[0.97] ${
              selected
                ? 'bg-primary-light shadow-lg shadow-primary-dark/15 ring-2 ring-primary'
                : 'bg-slate-50 ring-1 ring-inset ring-slate-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-md'
            }`}
          >
            {selected ? (
              <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-primary text-white">
                <IconCheck size={12} />
              </span>
            ) : null}
            <ProviderIcon type={option.value} />
            <span className="text-sm font-bold leading-tight text-slate-900">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Liens stylés                                                        */
/* ------------------------------------------------------------------ */

const LINK_BUTTON_VARIANTS = {
  primary: 'bg-gradient-ocean text-white shadow-lg shadow-primary-dark/30 hover:shadow-xl hover:shadow-primary-dark/40',
  secondary: 'bg-white text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 hover:bg-slate-50 hover:shadow-md',
} as const;

type LinkButtonProps = {
  href: string;
  variant?: keyof typeof LINK_BUTTON_VARIANTS;
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function LinkButton({ href, variant = 'primary', icon, className = '', children }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 active:translate-y-0 active:scale-[0.98] ${LINK_BUTTON_VARIANTS[variant]} ${className}`}
    >
      {icon}
      {children}
    </Link>
  );
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="dispute-fade-up inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-slate-700 shadow-sm ring-1 ring-inset ring-slate-200 transition-all hover:-translate-y-0.5 hover:shadow-md active:scale-[0.98]"
    >
      <IconArrowLeft size={16} />
      {children}
    </Link>
  );
}