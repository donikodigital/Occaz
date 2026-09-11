// mobile/src/theme/colors.ts
/**
 * Palette de la plateforme — choisie pour un marché mobilité + paiement
 * (Guinée/zone XOF), sans fond sombre. Indigo = marque/actions
 * principales, émeraude = argent/confirmation/confiance, ambre = notes
 * et énergie. Fond blanc cassé chaud plutôt que blanc clinique ou gris
 * froid. Validée visuellement avant implémentation (maquettes de
 * l'onboarding, l'accueil et les résultats de recherche).
 */
export const colors = {
  // Marque — indigo
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primaryLight: '#EEEDFE',
  onPrimary: '#FFFFFF',

  // Succès / argent / confirmation — émeraude
  success: '#10B981',
  successDark: '#047857',
  successLight: '#E1F5EE',
  onSuccess: '#FFFFFF',

  // Accent / énergie / notes — ambre
  accent: '#F59E0B',
  accentDark: '#92400E',
  accentLight: '#FDF1DC',
  onAccent: '#412402',

  // Danger
  danger: '#DC2626',
  dangerDark: '#7F1D1D',
  dangerLight: '#FCEBEB',
  onDanger: '#FFFFFF',

  // Neutres chauds
  background: '#FAFAF9',
  surface: '#FFFFFF',
  surfaceMuted: '#F4F3F0',
  border: '#E5E3DE',
  borderStrong: '#D3D1C7',

  textPrimary: '#1C1B1A',
  textSecondary: '#6B6862',
  textMuted: '#9C9A93',
  textOnDark: '#FFFFFF',

  overlay: 'rgba(28, 27, 26, 0.45)',
} as const;

export type ColorToken = keyof typeof colors;
