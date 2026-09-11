// mobile/src/hooks/useResponsive.ts
import { useWindowDimensions } from 'react-native';
import { breakpoints } from '@/theme';

export interface ResponsiveInfo {
  width: number;
  /** >= 768px (tablette portrait et plus) */
  isTablet: boolean;
  /** >= 1024px (desktop) — c'est le seuil qui bascule la navigation en barre latérale. */
  isDesktop: boolean;
  /** >= 1280px */
  isWide: boolean;
  /** Nombre de colonnes suggéré pour une grille de cartes à ce point de rupture. */
  columns: number;
}

/**
 * Point d'entrée unique pour toute décision de mise en page dépendant
 * de la largeur d'écran. Sur mobile natif (iOS/Android), `width` ne
 * dépasse jamais le seuil `tablet` : tous les indicateurs restent
 * `false` et le rendu est strictement identique à avant — ce hook
 * n'change rien tant que l'app tourne sur téléphone.
 */
export function useResponsive(): ResponsiveInfo {
  const { width } = useWindowDimensions();
  const isTablet = width >= breakpoints.tablet;
  const isDesktop = width >= breakpoints.desktop;
  const isWide = width >= breakpoints.wide;
  const columns = isWide ? 3 : isTablet ? 2 : 1;

  return { width, isTablet, isDesktop, isWide, columns };
}
