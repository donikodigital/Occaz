// mobile/src/types/shipmentPhotos.types.ts
// [19/10/2026] v1 — Photos du colis (2 au plus), prises dans le formulaire d'envoi.
export const MAX_PARCEL_PHOTOS = 2;

export type ParcelPhotoContentType = 'image/jpeg' | 'image/png' | 'image/webp';

export interface ParcelPhotoUploadUrl {
  storageKey: string;
  uploadUrl: string;
  expiresInSeconds: number;
}

/** Une photo d'un envoi, telle que renvoyée au client, au conducteur et au support : une URL signée, valable quelques minutes. */
export interface ShipmentPhoto {
  id: string;
  url: string;
  expiresInSeconds: number;
}

/** Une photo en cours de choix dans le formulaire : envoyée au stockage dès qu'elle est prise, rattachée à l'envoi à sa création. */
export interface ParcelPhotoDraft {
  /** Identifiant local (pas celui du serveur). */
  localId: string;
  uri: string;
  contentType: ParcelPhotoContentType;
  status: 'uploading' | 'done' | 'error';
  /** Clé de stockage, connue une fois la photo envoyée. */
  storageKey?: string;
}
