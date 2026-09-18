// web-admin/src/components/ui/Table.tsx
import React from 'react';

/** Table sobre à bordures fines — pas de cartes empilées pour des données tabulaires (voir la note de design du README). */
export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full text-left text-sm">{children}</table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return <thead className="border-b border-border bg-surface-muted/60">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>;
}

export function TableRow({
  children,
  className = '',
  ...rest
}: React.HTMLAttributes<HTMLTableRowElement> & { children: React.ReactNode }) {
  return (
    <tr className={className} {...rest}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-xs font-semibold text-text-muted ${className}`}>{children}</th>;
}

export function TableCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-text-primary ${className}`}>{children}</td>;
}