// mobile/src/components/illustrations/AuthIllustration.tsx
//
// v1 — Habillage des écrans d'authentification, inspiré du style Tiime
// (icône posée sur un aplat doux, accents "étincelle" dispersés autour)
// mais en bleu Ocean et sans rien reproduire de leur interface : formes
// géométriques originales (cercles, tirets arrondis), aucune illustration
// copiée. Un seul composant paramétré par l'icône affichée, pour ne pas
// dupliquer ce halo sur chaque écran (Bienvenue, Votre numéro, Entrez le
// code).

import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';
import { OCEAN } from '@/theme/ocean';

export interface AuthIllustrationProps {
  icon: React.ReactNode;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function AuthIllustration({ icon, size = 132, style }: AuthIllustrationProps) {
  return (
    <View style={[styles.container, { width: size, height: size }, style]}>
      <Svg width={size} height={size} viewBox="0 0 132 132" style={StyleSheet.absoluteFill}>
        {/* Aplat doux, en deux couches pour la profondeur */}
        <Circle cx="66" cy="66" r="62" fill={OCEAN.mist} />
        <Circle cx="80" cy="48" r="30" fill={OCEAN.sky} opacity={0.3} />

        {/* Étincelles décoratives */}
        <Rect x="97" y="14" width="16" height="5" rx="2.5" fill={OCEAN.gold} transform="rotate(45 105 16.5)" />
        <Rect x="108" y="30" width="10" height="4" rx="2" fill={OCEAN.bright} transform="rotate(45 113 32)" />
        <Circle cx="118" cy="20" r="4" fill={OCEAN.bright} opacity={0.55} />
        <Rect x="10" y="96" width="14" height="4" rx="2" fill={OCEAN.sky} transform="rotate(-35 17 98)" />
        <Rect x="24" y="110" width="10" height="4" rx="2" fill={OCEAN.gold} transform="rotate(-35 29 112)" />
        <Circle cx="16" cy="112" r="3.5" fill={OCEAN.gold} opacity={0.6} />
      </Svg>

      <View style={styles.badge}>{icon}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: OCEAN.deep,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
});