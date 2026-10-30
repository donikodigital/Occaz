// backend/src/i18n/texts/errors-pricing.ts
// [30/10/2026] v1 — Textes traduits (messages d'erreur) : [français, anglais, portugais (Portugal)].
import type { TextRow } from './index';

export const ERRORS_PRICING: readonly TextRow[] = [
  ["Aucun taux de change configuré entre {0} et {1} — un SuperAdmin doit créer le paramètre \"{2}\" (page Paramètres plateforme).", "No exchange rate is configured between {0} and {1} — a SuperAdmin must create the “{2}” setting (Platform settings page).", "Não está configurada nenhuma taxa de câmbio entre {0} e {1} — um SuperAdmin tem de criar o parâmetro «{2}» (página Parâmetros da plataforma)."],
  ["Impossible de calculer la distance : choisissez une adresse localisée sur la carte ou une ville dont les coordonnées sont renseignées.", "Unable to calculate the distance: choose an address located on the map or a city with known coordinates.", "Não é possível calcular a distância: escolha um endereço localizado no mapa ou uma cidade com coordenadas conhecidas."],
];
