// web-admin/src/components/ui/EntityAvatar.tsx
import React from 'react';

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

/** Avatar rond — photo si disponible, sinon initiales sur fond teinté. Cartes de liste et en-têtes de modal. */
export function EntityAvatar({ initials, imageUrl, size = 'md', tone = 'primary' }: EntityAvatarProps) {
  if (imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={imageUrl} alt="" className={`shrink-0 rounded-full object-cover ${SIZE_CLASSES[size]}`} />;
  }
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${SIZE_CLASSES[size]} ${TONE_CLASSES[tone]}`}>
      {initials}
    </span>
  );
}