// mobile/src/theme/typography.ts
/**
 * Inter — géométrique, très lisible en petite taille, standard des
 * applications mobilité/fintech les mieux notées actuellement. Chargée
 * via @expo-google-fonts/inter (voir app/_layout.tsx).
 */
export const fontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const fontSize = {
  xs: 12,
  sm: 13,
  base: 14,
  md: 15,
  lg: 17,
  xl: 19,
  xxl: 22,
  display: 28,
} as const;

export const lineHeight = {
  xs: 16,
  sm: 18,
  base: 20,
  md: 22,
  lg: 24,
  xl: 26,
  xxl: 29,
  display: 34,
} as const;
