// web-admin/src/components/ui/PasswordField.tsx
'use client';

import React, { useState } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';

export interface PasswordFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

/**
 * Même apparence que TextField, avec un bouton œil pour basculer la
 * visibilité — un mot de passe qu'on ne peut jamais relire est une
 * source d'erreurs de saisie inutile, surtout sur un outil interne où
 * la menace n'est pas quelqu'un qui regarde par-dessus l'épaule.
 */
export const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, error, className = '', id, ...rest }, ref) => {
    const [visible, setVisible] = useState(false);
    const inputId = id ?? rest.name;

    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text-secondary">
            {label}
          </label>
        ) : null}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            type={visible ? 'text' : 'password'}
            className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 pr-11 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              error ? 'border-danger' : 'border-border focus:border-primary'
            } ${className}`}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted transition-colors hover:text-text-secondary"
            aria-label={visible ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          >
            {visible ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </button>
        </div>
        {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);
PasswordField.displayName = 'PasswordField';
