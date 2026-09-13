// mobile/src/hooks/useDocumentUpload.ts
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
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

  async function uploadFromAsset(documentType: string, asset: ImagePicker.ImagePickerAsset) {
    const contentType = mimeTypeToContentType(asset.mimeType);
    if (!contentType) {
      Alert.alert('Format non supporté', 'Choisissez une photo au format JPEG, PNG ou WebP.');
      return;
    }

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
      Alert.alert('Échec de l\'envoi', "Le document n'a pas pu être envoyé — vérifiez votre connexion et réessayez.");
    } finally {
      setUploading(false);
    }
  }

  async function pickFromLibrary(documentType: string) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Autorisez l\'accès à vos photos pour envoyer ce document.');
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
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', "Autorisez l'accès à l'appareil photo pour envoyer ce document.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFromAsset(documentType, result.assets[0]);
  }

  return { pickFromLibrary, pickFromCamera, isUploading };
}
