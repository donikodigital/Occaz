// mobile/src/components/illustrations/ShipmentTileIllustration.tsx
//
// Flourish décoratif pour la tuile "Envois" (fond ambre) — cartons
// empilés + enveloppe, formes génériques. Même principe d'isolation
// que TripTileIllustration.tsx.

import React from 'react';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

export interface ShipmentTileIllustrationProps {
  size?: number;
}

export function ShipmentTileIllustration({ size = 130 }: ShipmentTileIllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="58" fill="rgba(28,27,26,0.05)" />

      {/* grand carton */}
      <Rect x="30" y="52" width="44" height="34" rx="4" fill="#FFFFFF" opacity={0.95} />
      <Line x1="30" y1="69" x2="74" y2="69" stroke="#92400E" strokeWidth={2.5} opacity={0.5} />
      <Line x1="52" y1="52" x2="52" y2="86" stroke="#92400E" strokeWidth={2.5} opacity={0.5} />

      {/* petit carton */}
      <Rect x="62" y="34" width="28" height="24" rx="3" fill="#FFFFFF" opacity={0.9} />
      <Line x1="62" y1="46" x2="90" y2="46" stroke="#92400E" strokeWidth={2} opacity={0.5} />
      <Line x1="76" y1="34" x2="76" y2="58" stroke="#92400E" strokeWidth={2} opacity={0.5} />

      {/* enveloppe */}
      <Rect x="14" y="70" width="30" height="20" rx="2.5" fill="#FFFFFF" opacity={0.85} />
      <Path
        d="M14 71 L29 83 L44 71"
        stroke="#92400E"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
      />
    </Svg>
  );
}