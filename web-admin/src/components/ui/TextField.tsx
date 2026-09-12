// web-admin/src/components/ui/TextField.tsx
'use client';

import React from 'react';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

/** Champ de saisie unique pour tout le back-office. `error` bascule la bordure en rouge et affiche le message sous le champ. */
export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text-secondary">
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={`w-full rounded-lg border bg-surface px-3.5 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            error ? 'border-danger' : 'border-border focus:border-primary'
          } ${className}`}
          {...rest}
        />
        {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
        {hint && !error ? <p className="mt-1.5 text-xs text-text-muted">{hint}</p> : null}
      </div>
    );
  },
);
TextField.displayName = 'TextField';
