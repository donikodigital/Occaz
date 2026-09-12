// web-admin/src/components/ui/TextArea.tsx
'use client';

import React from 'react';

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ label, error, hint, className = '', id, ...rest }, ref) => {
    const inputId = id ?? rest.name;
    return (
      <div className="w-full">
        {label ? (
          <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-text-secondary">
            {label}
          </label>
        ) : null}
        <textarea
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
TextArea.displayName = 'TextArea';
