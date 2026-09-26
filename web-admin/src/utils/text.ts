// web-admin/src/utils/text.ts

/**
 * Accord simple singulier/pluriel — le zéro et le un restent au
 * singulier ("0 chauffeur", "1 chauffeur"), le pluriel ne s'applique
 * qu'à partir de 2, comme en français standard. Ne couvre que le "+s"
 * régulier : pour un mot qui varie autrement (accord en genre, pluriel
 * irrégulier), passer directement la forme plurielle voulue comme
 * `singular` n'a pas de sens — traiter ce cas à la main à l'appel.
 */
export function plural(count: number, singular: string): string {
  return count > 1 ? `${singular}s` : singular;
}