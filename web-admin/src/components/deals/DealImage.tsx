// web-admin/src/components/deals/DealImage.tsx
// [13/10/2026] v1 — Vignette d'un bon plan : l'image si elle charge, sinon la tuile 🎟️. Une adresse qui n'est pas une image (page d'un site,
// lien cassé ou expiré) affichait jusqu'ici l'icône « image cassée » du navigateur ; ici on bascule sur la tuile et on prévient le parent
// (`onStatusChange`) pour que le formulaire puisse expliquer le problème.
'use client';

import React, { useEffect, useState } from 'react';

interface DealImageProps {
  src?: string | null;
  /** Classes de taille et d'arrondi, communes à l'image et à la tuile de repli. */
  className: string;
  /** Appelé à chaque changement d'adresse : `ok` vaut false si l'adresse ne mène pas à une image. */
  onStatusChange?: (ok: boolean) => void;
}

export function DealImage({ src, className, onStatusChange }: DealImageProps) {
  const [failed, setFailed] = useState(false);

  // Nouvelle adresse saisie : on réessaie.
  useEffect(() => {
    setFailed(false);
    onStatusChange?.(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  if (src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        onError={() => {
          setFailed(true);
          onStatusChange?.(false);
        }}
        className={`shrink-0 object-cover ${className}`}
      />
    );
  }
  return <span className={`flex shrink-0 items-center justify-center bg-accent-light ${className}`}>🎟️</span>;
}
