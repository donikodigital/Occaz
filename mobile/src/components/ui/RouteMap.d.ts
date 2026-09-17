// mobile/src/components/ui/RouteMap.d.ts
//
// Déclaration de types uniquement, lue par tsc — jamais par Metro (qui
// ignore les .d.ts lors de la résolution de modules au runtime). Résout
// l'ambiguïté qu'avait RouteMap.ts (.ts) qui pouvait entrer en conflit
// avec la résolution par plateforme de RouteMap.web.tsx / .native.tsx.
export { RouteMap } from './RouteMap.native';
export type { RouteMapProps, RouteMapPoint, RouteInfo } from './RouteMap.native';