// mobile/src/components/illustrations/TripTileIllustration.tsx
//
// Flourish décoratif pour la tuile "Créer un trajet" (fond indigo) —
// forme géométrique abstraite, pas une reproduction de véhicule réel
// ni de marque. Fichier isolé (voir HoverCard.tsx pour le même principe)
// plutôt que du SVG inline dans home.tsx, pour rester réutilisable et
// ne pas alourdir l'écran.

import React from 'react';
import Svg, { Circle, Line, Path } from 'react-native-svg';

export interface TripTileIllustrationProps {
  size?: number;
}

export function TripTileIllustration({ size = 130 }: TripTileIllustrationProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Circle cx="60" cy="60" r="58" fill="rgba(255,255,255,0.07)" />

      {/* route en pointillés */}
      <Path
        d="M10 92 Q60 78 110 92"
        stroke="rgba(255,255,255,0.28)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray="2 9"
        fill="none"
      />

      {/* carrosserie */}
      <Path
        d="M22 70 Q22 58 34 56 L44 44 Q48 40 54 40 L78 40 Q84 40 88 46 L94 56 Q104 57 104 68 L104 72 Q104 76 100 76 L96 76 A9 9 0 1 1 78 76 L48 76 A9 9 0 1 1 30 76 L26 76 Q22 76 22 72 Z"
        fill="#FFFFFF"
        opacity={0.95}
      />

      {/* vitres */}
      <Path d="M50 45 L56 45 L56 56 L44 56 Z" fill="#4F46E5" opacity={0.55} />
      <Path d="M60 45 L76 45 L84 56 L60 56 Z" fill="#4F46E5" opacity={0.55} />

      {/* roues */}
      <Circle cx="39" cy="76" r="9" fill="#1C1B1A" opacity={0.85} />
      <Circle cx="87" cy="76" r="9" fill="#1C1B1A" opacity={0.85} />
      <Circle cx="39" cy="76" r="3.5" fill="#FFFFFF" />
      <Circle cx="87" cy="76" r="3.5" fill="#FFFFFF" />

      {/* lignes de vitesse */}
      <Line x1="6" y1="52" x2="19" y2="52" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.5} />
      <Line x1="2" y1="62" x2="17" y2="62" stroke="#FFFFFF" strokeWidth={3} strokeLinecap="round" opacity={0.35} />
    </Svg>
  );
}