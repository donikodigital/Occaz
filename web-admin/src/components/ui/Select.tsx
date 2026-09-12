// web-admin/src/components/ui/Select.tsx
'use client';

import React from 'react';
import { IconChevronDown } from '@tabler/icons-react';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', id, children, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text-secondary">
            {label}
          </label>
        ) : null}
        <div className="relative">
          <select
            ref={ref}
            id={inputId}
            className={`w-full appearance-none rounded-lg border bg-surface px-3.5 py-2.5 pr-9 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 ${
              error ? 'border-danger' : 'border-border focus:border-primary'
            } ${className}`}
            {...rest}
          >
            {children}
          </select>
          <IconChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>
        {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
      </div>
    );
  },
);
Select.displayName = 'Select';
