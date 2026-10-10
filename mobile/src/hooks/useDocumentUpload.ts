// mobile/src/hooks/useDocumentUpload.ts
// [10/10/2026] v2 — plus d'Alert.alert (sans effet sur le web) : l'erreur est gardée par type de pièce (errorFor) et affichée sous son champ.
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import type {
  AppDocument,
  CreateDocumentPayload,
  RequestUploadUrlPayload,
  UploadableContentType,
  UploadUrlResult,
} from '@/types/documents.types';

export interface UseDocumentUploadParams {
  requestUploadUrl: (payload: RequestUploadUrlPayload) => Promise<UploadUrlResult>;
  confirmDocument: (payload: CreateDocumentPayload) => Promise<AppDocument>;
  /** Appelé une fois le document confirmé en base — typiquement pour invalider une query React Query. */
  onUploaded?: (document: AppDocument) => void;
}

function mimeTypeToContentType(mimeType: string | undefined): UploadableContentType | null {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp') return mimeType;
  // La caméra/galerie ne renvoie parfois pas de mimeType exploitable — jpeg est un choix par défaut raisonnable pour une photo.
  if (!mimeType || mimeType === 'image/jpg') return 'image/jpeg';
  return null;
}

/**
 * Flux en 3 étapes, jamais de fichier qui transite par notre serveur
 * NestJS (voir storage.service.ts côté backend) :
 *   1. Sélection de l'image (galerie ou appareil photo)
 *   2. PUT direct vers l'URL signée du stockage (R2/S3)
 *   3. Confirmation auprès du backend, qui crée la ligne Document
 * Si l'étape 2 ou 3 échoue, aucune ligne Document n'est créée — un
 * upload interrompu ne laisse donc aucune trace incohérente en base.
 */
export function useDocumentUpload({ requestUploadUrl, confirmDocument, onUploaded }: UseDocumentUploadParams) {
  const [isUploading, setUploading] = useState(false);
  // Une seule erreur à la fois, rattachée à la pièce concernée : chaque champ n'affiche que la sienne.
  const [error, setError] = useState<{ documentType: string; message: string } | null>(null);

  async function uploadFromAsset(documentType: string, asset: ImagePicker.ImagePickerAsset) {
    const contentType = mimeTypeToContentType(asset.mimeType);
    if (!contentType) {
      setError({ documentType, message: 'Format non supporté : choisissez une photo au format JPEG, PNG ou WebP.' });
      return;
    }

    setError(null);
    setUploading(true);
    try {
      const { storageKey, uploadUrl } = await requestUploadUrl({ type: documentType, contentType });

      const fileResponse = await fetch(asset.uri);
      const fileBlob = await fileResponse.blob();

      const putResponse = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
        body: fileBlob,
      });
      if (!putResponse.ok) {
        throw new Error(`Échec de l'envoi vers le stockage (${putResponse.status}).`);
      }

      const document = await confirmDocument({ type: documentType, storageKey });
      onUploaded?.(document);
    } catch {
      setError({ documentType, message: "Échec de l'envoi : le document n'a pas pu être envoyé — vérifiez votre connexion et réessayez." });
    } finally {
      setUploading(false);
    }
  }

  async function pickFromLibrary(documentType: string) {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError({ documentType, message: "Autorisation requise : autorisez l'accès à vos photos pour envoyer ce document." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFromAsset(documentType, result.assets[0]);
  }

  async function pickFromCamera(documentType: string) {
    setError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError({ documentType, message: "Autorisation requise : autorisez l'accès à l'appareil photo pour envoyer ce document." });
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFromAsset(documentType, result.assets[0]);
  }

  /** Message d'erreur à afficher sous le champ de cette pièce (null s'il n'y en a pas). */
  const errorFor = (documentType: string): string | null => (error?.documentType === documentType ? error.message : null);

  return { pickFromLibrary, pickFromCamera, isUploading, errorFor };
}
