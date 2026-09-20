// web-admin/src/components/ui/EntityAvatar.tsx
'use client';

import React, { useState } from 'react';

export interface EntityAvatarProps {
  initials: string;
  imageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  tone?: 'primary' | 'accent' | 'success' | 'danger' | 'neutral';
}

const SIZE_CLASSES: Record<NonNullable<EntityAvatarProps['size']>, string> = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-lg',
};

const TONE_CLASSES: Record<NonNullable<EntityAvatarProps['tone']>, string> = {
  primary: 'bg-primary-light text-primary-dark',
  accent: 'bg-accent-light text-accent-dark',
  success: 'bg-success-light text-success-dark',
  danger: 'bg-danger-light text-danger-dark',
  neutral: 'bg-surface-muted text-text-secondary',
};

/**
 * Avatar rond — photo si disponible, sinon initiales sur fond teinté.
 * `onError` bascule sur les initiales si l'URL échoue à charger (lien
 * cassé, signé et expiré...) — sans ce repli, un <img> avec un src
 * invalide affiche l'icône "image cassée" du navigateur indéfiniment.
 */
export function EntityAvatar({ initials, imageUrl, size = 'md', tone = 'primary' }: EntityAvatarProps) {
  const [failed, setFailed] = useState(false);

  if (imageUrl && !failed) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={imageUrl}
        alt=""
        onError={() => setFailed(true)}
        className={`shrink-0 rounded-full object-cover ${SIZE_CLASSES[size]}`}
      />
    );
  }
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}>
      {initials}
    </span>
  );
}