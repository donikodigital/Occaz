// mobile/src/components/ui/RouteMap.ts
//
// Fichier utilisé UNIQUEMENT par tsc, jamais par Metro au runtime. Dès
// que RouteMap.web.tsx ET RouteMap.native.tsx existent tous les deux
// dans ce dossier, Metro résout toujours './RouteMap' vers l'un des
// deux selon la plateforme (comportement natif de Metro, aucun réglage
// requis) — ce fichier-ci n'est donc jamais chargé au runtime.
//
// Il existe uniquement parce que `tsc` (npm run typecheck), contrairement
// à Metro, ne connaît pas la résolution par suffixe de plateforme :
// sans lui, `tsc` afficherait "Cannot find module './RouteMap'" partout
// où ce composant est importé.
//
// Alternative écartée : ajouter `moduleSuffixes` dans tsconfig.json.
// Testé et abandonné — ce réglage s'applique à TOUTE résolution de
// module, y compris dans node_modules, et a cassé le typage de
// @tabler/icons-react-native dans tout le projet. Ce fichier-leurre
// évite complètement ce risque.
export { RouteMap } from './RouteMap.native';
export type { RouteMapProps, RouteMapPoint, RouteInfo } from './RouteMap.native';