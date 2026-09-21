// mobile/src/theme/ocean.ts
//
// Palette « bleu océan » du profil chauffeur, partagée avec l'espace client.
// Le fichier du thème global n'est pas touché : les écrans qui veulent cette
// identité importent OCEAN, et les composants de OceanKit s'en servent.

export const OCEAN = {
  /** Fond du bandeau de profil, texte des grands titres sur fond clair. */
  deep: '#083A63',
  /** Couleur d'action : boutons, icônes, liens. */
  base: '#0B6BA8',
  /** Reflets, halos, éléments décoratifs. */
  bright: '#1E9BD7',
  sky: '#8FD3F4',
  /** Fond des champs et des pastilles claires. */
  mist: '#EAF5FB',
  /** Contours des cartes et séparateurs. */
  line: '#CFE4F2',
  /** Accent chaud (nom de famille du bandeau, avertissements doux). */
  gold: '#FFD166',
  goldSoft: '#FFF4D6',
  goldInk: '#8A5A00',
  onDark: '#FFFFFF',
} as const;