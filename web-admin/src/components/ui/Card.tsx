// web-admin/src/components/ui/Card.tsx
import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

/** Conteneur blanc à bordure fine — l'unité de base de toute fiche ou panneau. Ombre légère par défaut. */
export function Card({ padded = true, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl shadow-sm ${padded ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}