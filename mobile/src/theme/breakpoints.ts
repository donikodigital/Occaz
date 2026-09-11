// mobile/src/theme/breakpoints.ts
/**
 * Points de rupture pour l'affichage web (React Native Web) — sur
 * mobile natif, `width` ne dépasse jamais `tablet`, donc ces valeurs
 * n'ont aucun effet sur iOS/Android : elles ne s'activent qu'en usage
 * desktop/navigateur (section demandée : "tout doit être responsive
 * mobile et desktop").
 */
export const breakpoints = {
  mobile: 0,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

/**
 * Largeurs maximales de contenu par type d'écran — un formulaire ne
 * doit jamais s'étirer sur toute la largeur d'un écran 27", une liste
 * ou un tableau de bord peut légitimement utiliser plus d'espace.
 */
export const maxContentWidth = {
  form: 480,
  detail: 640,
  content: 860,
  wide: 1120,
} as const;

export const sidebarWidth = 240;
