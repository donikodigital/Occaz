// web-admin/src/components/auth/AuthIllustration.tsx
//
// Équivalent web de mobile/src/components/illustrations/AuthIllustration.tsx :
// le logo Occa'Z (pin) posé sur un badge bleu profond, au centre d'un aplat
// doux à étincelles — mêmes formes, mêmes couleurs que l'écran Bienvenue de
// l'app, pour que le back-office soit reconnaissable au premier regard.
import React from 'react';
import Image from 'next/image';

const OCEAN = {
  deep: '#083a63',
  bright: '#1e9bd7',
  sky: '#8fd3f4',
  mist: '#eaf5fb',
  gold: '#ffd166',
} as const;

export interface AuthIllustrationProps {
  /** Côté du cadre en pixels (132 = taille de l'app mobile). */
  size?: number;
  className?: string;
}

export function AuthIllustration({ size = 132, className = '' }: AuthIllustrationProps) {
  const badge = Math.round((size * 64) / 132);
  const logoWidth = Math.round(badge * 0.5);
  const logoHeight = Math.round(logoWidth * (412 / 320));

  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg width={size} height={size} viewBox="0 0 132 132" className="absolute inset-0" fill="none">
        {/* Aplat doux en deux couches, pour la profondeur */}
        <circle cx="66" cy="66" r="62" fill={OCEAN.mist} />
        <circle cx="80" cy="48" r="30" fill={OCEAN.sky} opacity="0.3" />

        {/* Étincelles décoratives */}
        <rect x="97" y="14" width="16" height="5" rx="2.5" fill={OCEAN.gold} transform="rotate(45 105 16.5)" />
        <rect x="108" y="30" width="10" height="4" rx="2" fill={OCEAN.bright} transform="rotate(45 113 32)" />
        <circle cx="118" cy="20" r="4" fill={OCEAN.bright} opacity="0.55" />
        <rect x="10" y="96" width="14" height="4" rx="2" fill={OCEAN.sky} transform="rotate(-35 17 98)" />
        <rect x="24" y="110" width="10" height="4" rx="2" fill={OCEAN.gold} transform="rotate(-35 29 112)" />
        <circle cx="16" cy="112" r="3.5" fill={OCEAN.gold} opacity="0.6" />
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="flex items-center justify-center shadow-xl shadow-primary-dark/30"
          style={{ width: badge, height: badge, borderRadius: Math.round(badge * 0.31), backgroundColor: OCEAN.deep }}
        >
          <Image
            src="/brand/pin-glyph.png"
            alt=""
            width={logoWidth}
            height={logoHeight}
            priority
            style={{ width: logoWidth, height: logoHeight }}
          />
        </div>
      </div>
    </div>
  );
}