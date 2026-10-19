// backend/src/shipments/shipment-photos.util.ts
// [19/10/2026] v1 — Photos du colis (2 au plus), prises par l'expéditeur dans le formulaire d'envoi et visibles ensuite par l'expéditeur, le
// conducteur et le personnel. Une photo = une ligne Document (ownerType SHIPMENT, type « parcel_photo ») ; le fichier reste PRIVÉ dans le
// stockage (lecture par URL signée de 5 minutes, voir ShipmentPhotosService).
//
// Ce fichier ne contient que des règles pures (sans base de données) : le format des clés de stockage et leur validation à la création.
import { BadRequestException } from '@nestjs/common';

export const PARCEL_PHOTO_TYPE = 'parcel_photo';
export const MAX_PARCEL_PHOTOS = 2;
/** Dossier de stockage : buildKey('shipment-photo', customerId, ext) → « shipment-photo/<client>/<uuid>.<ext> ». */
export const PARCEL_PHOTO_FOLDER = 'shipment-photo';

/**
 * Vérifie les clés de stockage envoyées à la création d'un envoi : 2 au plus, toutes distinctes, et chacune doit avoir été fabriquée pour CE
 * client (dossier à son nom, nom généré par le serveur). Sans ce contrôle, un client pourrait rattacher à son envoi la photo d'un autre.
 * Renvoie la liste nettoyée, dans l'ordre reçu.
 */
export function validateParcelPhotoKeys(customerId: string, keys: readonly string[] | undefined): string[] {
  if (!keys || keys.length === 0) return [];
  if (keys.length > MAX_PARCEL_PHOTOS) {
    throw new BadRequestException(`Vous pouvez joindre ${MAX_PARCEL_PHOTOS} photos au plus.`);
  }
  const pattern = new RegExp(`^${PARCEL_PHOTO_FOLDER}/${escapeRegExp(customerId)}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|png|webp)$`);
  const seen = new Set<string>();
  for (const key of keys) {
    if (typeof key !== 'string' || !pattern.test(key)) {
      throw new BadRequestException('Photo invalide : renvoyez la photo depuis le formulaire.');
    }
    if (seen.has(key)) throw new BadRequestException('La même photo ne peut pas être jointe deux fois.');
    seen.add(key);
  }
  return [...seen];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
