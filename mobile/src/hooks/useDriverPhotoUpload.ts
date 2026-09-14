// mobile/src/hooks/useDriverPhotoUpload.ts
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { driverProfilesApi } from '@/services/api/driverProfiles.api';
import type { UploadableContentType } from '@/types/documents.types';
import type { DriverProfile } from '@/types/profiles.types';

function mimeTypeToContentType(mimeType: string | undefined): UploadableContentType | null {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp') return mimeType;
  if (!mimeType || mimeType === 'image/jpg') return 'image/jpeg';
  return null;
}

/**
 * Même flux en 3 étapes que useDocumentUpload, mais un contrat plus
 * simple (une seule photo, pas de notion de "type") et un recadrage
 * carré imposé (allowsEditing + aspect 1:1) — pertinent pour un avatar,
 * jamais souhaitable pour une pièce d'identité (d'où deux hooks
 * distincts plutôt qu'un seul généralisé à outrance).
 */
export function useDriverPhotoUpload(onUploaded?: (profile: DriverProfile) => void) {
  const [isUploading, setUploading] = useState(false);

  async function uploadFromAsset(asset: ImagePicker.ImagePickerAsset) {
    const contentType = mimeTypeToContentType(asset.mimeType);
    if (!contentType) {
      Alert.alert('Format non supporté', 'Choisissez une photo au format JPEG, PNG ou WebP.');
      return;
    }

    setUploading(true);
    try {
      const { storageKey, uploadUrl } = await driverProfilesApi.requestPhotoUploadUrl({ type: 'profile_photo', contentType });

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

      const profile = await driverProfilesApi.confirmPhoto(storageKey);
      onUploaded?.(profile);
    } catch {
      Alert.alert('Échec de l\'envoi', "La photo n'a pas pu être envoyée — vérifiez votre connexion et réessayez.");
    } finally {
      setUploading(false);
    }
  }

  async function pickFromLibrary() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', 'Autorisez l\'accès à vos photos pour envoyer votre photo de profil.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFromAsset(result.assets[0]);
  }

  async function pickFromCamera() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Autorisation requise', "Autorisez l'accès à l'appareil photo pour envoyer votre photo de profil.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    await uploadFromAsset(result.assets[0]);
  }

  return { pickFromLibrary, pickFromCamera, isUploading };
}
