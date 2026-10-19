// mobile/src/hooks/useShipmentPhotos.ts
// [19/10/2026] v1 — Photos du colis.
//   • useParcelPhotoDrafts : dans le formulaire d'envoi, prend ou choisit jusqu'à 2 photos et les envoie au stockage tout de suite ;
//     le formulaire ne transmet à POST /shipments que leurs clés (`photoKeys`).
//   • useShipmentPhotos : lit les photos d'un envoi (URL signées de quelques minutes) pour l'expéditeur, le conducteur et le support.
// Le flux d'envoi est celui des autres photos de l'application : URL signée, dépôt direct (PUT) dans le stockage.
import { useCallback, useRef, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { shipmentPhotosApi } from '@/services/api/shipmentPhotos.api';
import {
  MAX_PARCEL_PHOTOS,
  type ParcelPhotoContentType,
  type ParcelPhotoDraft,
} from '@/types/shipmentPhotos.types';

function toContentType(mimeType: string | null | undefined): ParcelPhotoContentType | null {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp') return mimeType;
  if (!mimeType || mimeType === 'image/jpg') return 'image/jpeg';
  return null;
}

let localCounter = 0;
const nextLocalId = () => `photo-${Date.now()}-${localCounter++}`;

export function useParcelPhotoDrafts() {
  const [photos, setPhotos] = useState<ParcelPhotoDraft[]>([]);
  // Copie synchrone de la liste : deux choix enchaînés très vite ne doivent pas dépasser 2 photos, ni perdre une mise à jour.
  const photosRef = useRef<ParcelPhotoDraft[]>([]);
  const commit = useCallback((update: (current: ParcelPhotoDraft[]) => ParcelPhotoDraft[]) => {
    photosRef.current = update(photosRef.current);
    setPhotos(photosRef.current);
  }, []);
  // Message à afficher dans la page (Alert.alert ne fait rien sur le web) ; effacé à la prochaine action.
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((localId: string, change: Partial<ParcelPhotoDraft>) => {
    commit((current) => current.map((photo) => (photo.localId === localId ? { ...photo, ...change } : photo)));
  }, [commit]);

  const upload = useCallback(
    async (draft: ParcelPhotoDraft) => {
      patch(draft.localId, { status: 'uploading' });
      try {
        const { storageKey, uploadUrl } = await shipmentPhotosApi.requestUploadUrl(draft.contentType);
        const fileResponse = await fetch(draft.uri);
        const fileBlob = await fileResponse.blob();
        const putResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': draft.contentType },
          body: fileBlob,
        });
        if (!putResponse.ok) throw new Error(`stockage ${putResponse.status}`);
        patch(draft.localId, { status: 'done', storageKey });
      } catch {
        patch(draft.localId, { status: 'error' });
      }
    },
    [patch],
  );

  const addAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      const contentType = toContentType(asset.mimeType);
      if (!contentType) {
        setError('Format non supporté : choisissez une photo au format JPEG, PNG ou WebP.');
        return;
      }
      if (photosRef.current.length >= MAX_PARCEL_PHOTOS) {
        setError(`Vous pouvez joindre ${MAX_PARCEL_PHOTOS} photos au plus.`);
        return;
      }
      const draft: ParcelPhotoDraft = { localId: nextLocalId(), uri: asset.uri, contentType, status: 'uploading' };
      commit((current) => [...current, draft]);
      void upload(draft);
    },
    [upload, commit],
  );

  const pickFromCamera = useCallback(async () => {
    setError(null);
    if (photosRef.current.length >= MAX_PARCEL_PHOTOS) return setError(`Vous pouvez joindre ${MAX_PARCEL_PHOTOS} photos au plus.`);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setError("Autorisation requise : autorisez l'accès à l'appareil photo pour photographier votre colis.");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 });
      if (result.canceled || !result.assets?.[0]) return;
      addAsset(result.assets[0]);
    } catch {
      setError("L'appareil photo n'est pas disponible : choisissez une photo dans votre galerie.");
    }
  }, [addAsset]);

  const pickFromLibrary = useCallback(async () => {
    setError(null);
    if (photosRef.current.length >= MAX_PARCEL_PHOTOS) return setError(`Vous pouvez joindre ${MAX_PARCEL_PHOTOS} photos au plus.`);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setError("Autorisation requise : autorisez l'accès à vos photos pour joindre une photo du colis.");
        return;
      }
      const remaining = MAX_PARCEL_PHOTOS - photosRef.current.length;
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: remaining > 1,
        selectionLimit: remaining,
      });
      if (result.canceled || !result.assets?.length) return;
      for (const asset of result.assets.slice(0, remaining)) addAsset(asset);
    } catch {
      setError("La galerie n'est pas disponible pour le moment — réessayez.");
    }
  }, [addAsset]);

  const remove = useCallback((localId: string) => {
    setError(null);
    commit((current) => current.filter((photo) => photo.localId !== localId));
  }, [commit]);

  const retry = useCallback(
    (localId: string) => {
      setError(null);
      const draft = photosRef.current.find((photo) => photo.localId === localId);
      if (draft) void upload(draft);
    },
    [upload],
  );

  return {
    photos,
    error,
    pickFromCamera,
    pickFromLibrary,
    remove,
    retry,
    canAddMore: photos.length < MAX_PARCEL_PHOTOS,
    isUploading: photos.some((photo) => photo.status === 'uploading'),
    hasFailed: photos.some((photo) => photo.status === 'error'),
    /** Clés de stockage des photos bien envoyées, dans l'ordre — ce que POST /shipments attend. */
    readyKeys: photos.flatMap((photo) => (photo.status === 'done' && photo.storageKey ? [photo.storageKey] : [])),
  };
}

export type ParcelPhotoDrafts = ReturnType<typeof useParcelPhotoDrafts>;

/** Photos d'un envoi. Les URL signées durent 5 minutes : on les relit un peu avant. */
export function useShipmentPhotos(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['shipments', shipmentId, 'photos'],
    queryFn: () => shipmentPhotosApi.list(shipmentId!),
    enabled: Boolean(shipmentId),
    staleTime: 3 * 60_000,
    refetchInterval: 4 * 60_000,
    retry: false,
  });
}
