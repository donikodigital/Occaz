// backend/src/storage/storage-key.util.ts
//
// [25/10/2026] v2 — extensions acceptées paramétrables (documents de l'entreprise : Word, Excel…), PDF et photos par défaut comme avant.
// [25/10/2026] v1 — Règles pures sur les clés de stockage (sans base de données ni réseau).
// Une clé est fabriquée par le serveur (StorageService.buildKey) : « <dossier>/<identifiant du propriétaire>/<uuid>.<extension> ». Quand le client
// « confirme » un envoi, il renvoie cette clé : sans contrôle, il pourrait y glisser celle d'un autre (photo publique d'un autre utilisateur, par
// exemple, effacée ensuite avec « Supprimer ce document ») ou un chemin quelconque du stockage. On exige donc que la clé ait été fabriquée pour CE
// propriétaire, avec le nom généré par le serveur.
import { BadRequestException } from '@nestjs/common';

export interface StorageKeyOwner {
  /** Dossier choisi à la fabrication de la clé : 'driver', 'driver-avatar', 'customer-avatar', 'vehicle', 'shipment-photo'… */
  folder: string;
  /** Identifiant du propriétaire utilisé à la fabrication (profil conducteur, profil client, véhicule…). */
  ownerId: string;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** Extensions des fichiers « pièces » (photos et PDF) : celles de tous les usages historiques. */
export const DEFAULT_KEY_EXTENSIONS: readonly string[] = ['jpg', 'png', 'webp', 'pdf'];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Vrai si `key` a été fabriquée pour l'un de ces propriétaires. */
export function isStorageKeyOwnedBy(
  key: unknown,
  owners: readonly StorageKeyOwner[],
  extensions: readonly string[] = DEFAULT_KEY_EXTENSIONS,
): boolean {
  if (typeof key !== 'string' || key.length === 0 || key.length > 300 || extensions.length === 0) return false;
  const allowed = `(${extensions.map(escapeRegExp).join('|')})`;
  return owners.some(({ folder, ownerId }) => {
    if (!folder || !ownerId) return false;
    return new RegExp(`^${escapeRegExp(folder)}/${escapeRegExp(ownerId)}/${UUID}\\.${allowed}$`).test(key);
  });
}

/** Renvoie la clé si elle appartient à l'un des propriétaires, sinon refuse en 400 (jamais d'erreur 500). */
export function assertStorageKeyOwnedBy(
  key: unknown,
  owners: readonly StorageKeyOwner[],
  message = "Fichier invalide : envoyez-le de nouveau depuis l'application.",
  extensions: readonly string[] = DEFAULT_KEY_EXTENSIONS,
): string {
  if (!isStorageKeyOwnedBy(key, owners, extensions)) throw new BadRequestException(message);
  return key as string;
}

/**
 * Une photo de profil n'est acceptée que si elle est hébergée par NOTRE stockage public : sinon n'importe quel lien externe s'afficherait
 * chez tous les utilisateurs (suivi d'adresse IP, contenu choquant). Renvoie `undefined` quand le lien est refusé ou que le stockage public
 * n'est pas configuré — l'ancienne photo reste alors en place.
 */
export function ownPublicPhotoUrl(url: string | null | undefined, publicBaseUrl = process.env.STORAGE_PUBLIC_BASE_URL): string | undefined {
  if (!url || !publicBaseUrl) return undefined;
  const prefix = `${publicBaseUrl.replace(/\/$/, '')}/`;
  return url.startsWith(prefix) && !url.slice(prefix.length).includes('..') ? url : undefined;
}
