// web-admin/src/components/ui/Card.tsx
import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

/** Conteneur blanc à bordure fine — l'unité de base de toute fiche ou panneau. Jamais d'ombre (cohérence avec l'app mobile). */
export function Card({ padded = true, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-surface border border-border rounded-xl ${padded ? 'p-5' : ''} ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
