// mobile/src/services/api/shipmentPhotos.api.ts
// [19/10/2026] v1 — Photos du colis : URL d'envoi (avant la création de l'envoi) et lecture des photos d'un envoi.
import { api } from './client';
import type { ParcelPhotoContentType, ParcelPhotoUploadUrl, ShipmentPhoto } from '@/types/shipmentPhotos.types';

export const shipmentPhotosApi = {
  requestUploadUrl: (contentType: ParcelPhotoContentType) =>
    api.post<ParcelPhotoUploadUrl>('/shipments/photos/upload-url', { contentType }),

  list: (shipmentId: string) => api.get<ShipmentPhoto[]>(`/shipments/${shipmentId}/photos`),
};
