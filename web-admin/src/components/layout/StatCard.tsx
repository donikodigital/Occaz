// web-admin/src/components/layout/StatCard.tsx
import React from 'react';
import { Card } from '@/components/ui';

export interface StatCardProps {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  sublabel?: string;
  tone?: 'primary' | 'success' | 'accent' | 'danger';
  /** Position dans la grille — décale légèrement l'entrée en fondu de chaque carte pour un effet de vague plutôt qu'un bloc qui apparaît d'un coup. */
  index?: number;
}

const TONE_CLASSES: Record<
  NonNullable<StatCardProps['tone']>,
  { icon: string; iconGlow: string; bar: string }
> = {
  primary: { icon: 'from-primary-light to-primary-light/50 text-primary-dark', iconGlow: 'bg-primary/25', bar: 'bg-primary' },
  success: { icon: 'from-success-light to-success-light/50 text-success-dark', iconGlow: 'bg-success/25', bar: 'bg-success' },
  accent: { icon: 'from-accent-light to-accent-light/50 text-accent-dark', iconGlow: 'bg-accent/25', bar: 'bg-accent' },
  danger: { icon: 'from-danger-light to-danger-light/50 text-danger-dark', iconGlow: 'bg-danger/25', bar: 'bg-danger' },
};

/**
 * 3 par ligne dès mobile (demande explicite) : le libellé passe donc sur
 * 2 lignes plutôt que d'être tronqué (qui rendait "Chauffeurs vérifiés"
 * et "Utilisateurs actifs" indiscernables l'un de l'autre) — une hauteur
 * minimale réservée pour ce bloc garde toutes les cartes d'une même
 * ligne alignées, que leur libellé tienne sur 1 ou 2 lignes.
 */
export function StatCard({ label, value, icon: Icon, sublabel, tone = 'primary', index = 0 }: StatCardProps) {
  const { icon, iconGlow, bar } = TONE_CLASSES[tone];
  return (
    <Card
      padded={false}
      className="group animate-in relative flex flex-col gap-2 overflow-hidden rounded-xl p-2.5 opacity-0 shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-xl sm:gap-3 sm:rounded-2xl sm:p-4"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className={`absolute inset-x-0 bottom-0 h-[3px] scale-x-0 transition-transform duration-300 group-hover:scale-x-100 ${bar}`} />

      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center sm:h-11 sm:w-11">
        <span className={`absolute inset-0 rounded-lg blur-md transition-opacity duration-300 group-hover:opacity-80 sm:rounded-xl ${iconGlow} opacity-50`} />
        <div
          className={`relative flex h-full w-full items-center justify-center rounded-lg bg-gradient-to-br transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 sm:rounded-xl ${icon}`}
        >
          <Icon size={16} className="sm:hidden" />
          <Icon size={21} className="hidden sm:block" />
        </div>
      </div>

      <div className="min-w-0">
        <p className="line-clamp-2 min-h-[24px] text-[10px] leading-tight text-text-secondary sm:min-h-[34px] sm:text-sm">
          {label}
        </p>
        <p className="text-lg font-bold leading-tight tracking-tight text-text-primary tabular-nums transition-transform duration-300 group-hover:scale-[1.04] sm:text-[28px]">
          {value}
        </p>
        {sublabel ? <p className="truncate text-[9px] leading-tight text-text-muted sm:text-xs">{sublabel}</p> : null}
      </div>
    </Card>
  );
}