// web-admin/src/components/admin/AdminUi.tsx
//
// Briques communes aux pages d'administration refaites (Retraits,
// Tarification, Catégories d'envoi, Modèles de notification, Traductions…) :
// même bandeau, mêmes états vides, mêmes filtres, onglets, cartes de
// formulaire, pastilles et interrupteurs — pour ne plus recopier ces blocs
// dans chaque page. Règle de design : des cartes ombrées, jamais de tableaux.
// Les blancs du bandeau sont des valeurs arbitraires (text-[#ffffff]) pour
// ne dépendre d'aucune couleur « white » du thème Tailwind.

'use client';

import React from 'react';
import Link from 'next/link';
import { IconAlertTriangle, IconArrowLeft } from '@tabler/icons-react';

/** Drapeau emoji à partir d'un code pays ISO à 2 lettres ; 🏳️ si le code est invalide. */
export function isoToFlagEmoji(isoCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(isoCode)) return '🏳️';
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

// ---------------------------------------------------------------------------
// Bandeau d'en-tête
// ---------------------------------------------------------------------------

export interface HeroStat {
  value: string;
  label: string;
}

export function PageHero({
  eyebrow,
  title,
  description,
  stats,
}: {
  eyebrow: string;
  title: string;
  description: string;
  stats?: HeroStat[];
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-5 shadow-lg sm:p-6">
      <span className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[rgba(255,255,255,0.10)]" />
      <span className="pointer-events-none absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-[rgba(255,255,255,0.07)]" />
      <div className="relative">
        <p className="text-sm font-medium text-[rgba(255,255,255,0.75)]">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold text-[#ffffff] sm:text-3xl">{title}</h1>
        <p className="mt-1.5 max-w-xl text-sm text-[rgba(255,255,255,0.82)]">{description}</p>
      </div>
      {stats && stats.length > 0 ? (
        <div className="relative mt-4 flex flex-wrap gap-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-[rgba(255,255,255,0.14)] px-4 py-2.5 backdrop-blur-sm">
              <p className="text-xl font-bold leading-none text-[#ffffff]">{stat.value}</p>
              <p className="mt-1 text-[11px] font-medium text-[rgba(255,255,255,0.8)]">{stat.label}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// États
// ---------------------------------------------------------------------------

export function Notice({ tone = 'warning', children }: { tone?: 'warning' | 'danger'; children: React.ReactNode }) {
  const classes = tone === 'danger' ? 'bg-danger-light/40 text-danger-dark' : 'bg-accent-light text-accent-dark';
  return (
    <div className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-sm ${classes}`}>
      <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">{icon}</span>
      <p className="mt-4 font-semibold text-text-primary">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ListSkeleton({ count = 4, heightClass = 'h-32' }: { count?: number; heightClass?: string }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`${heightClass} animate-pulse rounded-2xl bg-border/50`} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filtres, onglets, choix
// ---------------------------------------------------------------------------

interface Option<T extends string> {
  value: T;
  label: string;
}

/** Pastilles de filtre sur une ligne défilante : « Tous » + une pastille par valeur. */
export function FilterChips<T extends string>({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: T | '';
  onChange: (value: T | '') => void;
  options: Option<T>[];
  allLabel: string;
}) {
  const all: { value: T | ''; label: string }[] = [{ value: '', label: allLabel }, ...options];
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {all.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value || 'all'}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={isActive}
            className={`shrink-0 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
              isActive
                ? 'border-primary bg-primary text-[#ffffff] shadow-sm'
                : 'border-border bg-surface text-text-secondary hover:border-primary/40'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface TabDefinition<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

export function Tabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T;
  onChange: (value: T) => void;
  items: TabDefinition<T>[];
}) {
  return (
    <div role="tablist" className="flex gap-1 rounded-2xl border border-border bg-surface p-1 shadow-sm">
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.value)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive ? 'bg-primary text-[#ffffff] shadow-sm' : 'text-text-secondary hover:bg-primary-light/50'
            }`}
          >
            {item.icon ? <span className="hidden sm:inline-flex">{item.icon}</span> : null}
            <span className="truncate">{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive ? 'bg-[rgba(255,255,255,0.22)] text-[#ffffff]' : 'bg-primary-light text-primary'
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** Choix exclusif entre 2 à 3 options, en grandes tuiles — remplace un <select> pour les choix courts. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  ariaLabel: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(option.value)}
            className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
              isActive
                ? 'border-primary bg-primary-light text-primary ring-1 ring-primary/30'
                : 'border-border bg-surface text-text-secondary hover:border-primary/40'
            }`}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaires
// ---------------------------------------------------------------------------

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description ? <p className="text-xs text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-danger-light/40 px-3 py-2.5 text-sm text-danger-dark">
      <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cartes de formulaire, pastilles, interrupteur, liens
// ---------------------------------------------------------------------------

/** Section de formulaire posée sur une carte ombrée. */
export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-md sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {description ? <p className="mt-0.5 text-xs text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

const CHIP_TONES = {
  primary: 'bg-primary-light text-primary',
  neutral: 'bg-border/40 text-text-secondary',
  success: 'bg-success-light text-success-dark',
  accent: 'bg-accent-light text-accent-dark',
  danger: 'bg-danger-light text-danger-dark',
} as const;

export function Chip({
  tone = 'neutral',
  icon,
  children,
}: {
  tone?: keyof typeof CHIP_TONES;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${CHIP_TONES[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

/** Interrupteur avec son explication — le composant Switch cachait le début du libellé. */
export function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-primary/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-text-secondary">{description}</span> : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-[#ffffff] shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

/** Lien d'action principal (même rendu qu'un bouton plein) — évite d'imbriquer un <button> dans un <a>. */
export function LinkButton({ href, icon, children }: { href: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-[#ffffff] shadow-md transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      {icon}
      {children}
    </Link>
  );
}

/** En-tête des pages de création / modification : retour, titre, sous-titre. */
export function BackHeader({
  href,
  backLabel,
  title,
  subtitle,
  badge,
}: {
  href: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-secondary shadow-sm transition hover:-translate-y-0.5 hover:text-text-primary hover:shadow-md"
      >
        <IconArrowLeft size={16} />
        {backLabel}
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-text-primary">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-text-secondary">{subtitle}</p> : null}
        </div>
        {badge}
      </div>
    </div>
  );
}

/** Bandeau de confirmation après une sauvegarde. */
export function SavedNotice({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-success-light px-4 py-3 text-sm font-medium text-success-dark">{children}</div>
  );
}