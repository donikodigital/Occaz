// web-admin/src/components/ui/Disclosure.tsx
'use client';

import React, { useState } from 'react';
import { IconChevronDown } from '@tabler/icons-react';

export interface DisclosureProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  /** Rendu à droite du titre, hors de la zone cliquable qui replie/déplie (ex: bouton "Ajouter" utilisable sans ouvrir le tiroir). */
  action?: React.ReactNode;
}

/** Tiroir repliable générique — évite d'inonder la page quand plusieurs listes se suivent (ex. Régions + Préfectures). Fermé par défaut sauf indication contraire. */
export function Disclosure({ title, subtitle, defaultOpen = false, children, action }: DisclosureProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-border bg-surface-muted/30">
      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex flex-1 items-center justify-between gap-2 text-left"
          aria-expanded={open}
        >
          <span className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-text-secondary">{title}</span>
            {subtitle ? <span className="text-xs text-text-muted">{subtitle}</span> : null}
          </span>
          <IconChevronDown size={16} className={`shrink-0 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {action}
      </div>
      {open ? <div className="border-t border-border p-4">{children}</div> : null}
    </div>
  );
}