// mobile/src/components/ui/ProfilePhotoField.tsx
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { IconCamera, IconPhoto } from '@tabler/icons-react-native';
import { AppText } from './AppText';
import { Avatar } from './Avatar';
import { IconButton } from './IconButton';
import { colors, spacing } from '@/theme';

export interface ProfilePhotoFieldProps {
  photoUrl?: string | null;
  initials: string;
  isUploading: boolean;
  onPickLibrary: () => void;
  onPickCamera: () => void;
  /** Affiche un rappel visuel tant qu'aucune photo n'est envoyée — la validation du compte en dépend (voir DriverProfilesService.verify). */
  isRequired?: boolean;
}

export function ProfilePhotoField({
  photoUrl,
  initials,
  isUploading,
  onPickLibrary,
  onPickCamera,
  isRequired,
}: ProfilePhotoFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.avatarWrap}>
        <Avatar imageUri={photoUrl} initials={initials} size={96} />
        {isUploading ? (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : null}
      </View>

      <View style={styles.actions}>
        <IconButton
          icon={<IconPhoto size={17} color={colors.textPrimary} />}
          accessibilityLabel="Choisir depuis la galerie"
          onPress={onPickLibrary}
        />
        <IconButton
          icon={<IconCamera size={17} color={colors.textPrimary} />}
          accessibilityLabel="Prendre une photo"
          onPress={onPickCamera}
        />
      </View>

      {isRequired && !photoUrl ? (
        <AppText variant="xs" color="danger" style={styles.requiredNote}>
          Obligatoire avant la validation de votre compte
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  avatarWrap: {
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  requiredNote: {
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
