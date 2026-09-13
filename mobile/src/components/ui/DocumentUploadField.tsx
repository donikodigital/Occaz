// mobile/src/components/ui/DocumentUploadField.tsx
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { IconCamera, IconCheck, IconPhoto } from '@tabler/icons-react-native';
import { AppText } from './AppText';
import { Badge } from './Badge';
import { IconButton } from './IconButton';
import { colors, radius, spacing } from '@/theme';
import type { AppDocument } from '@/types/documents.types';

export interface DocumentUploadFieldProps {
  label: string;
  document?: AppDocument;
  isUploading: boolean;
  onPickLibrary: () => void;
  onPickCamera: () => void;
}

const STATUS_LABEL: Record<AppDocument['status'], string> = {
  PENDING: 'En attente de vérification',
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté — à renvoyer',
};
const STATUS_TONE: Record<AppDocument['status'], 'accent' | 'success' | 'danger'> = {
  PENDING: 'accent',
  VERIFIED: 'success',
  REJECTED: 'danger',
};

/** Un champ par type de pièce (CNI, permis, carte grise...) — la même pièce peut être renvoyée si rejetée, un nouvel envoi remplace simplement l'ancien statut à l'écran suivant. */
export function DocumentUploadField({ label, document, isUploading, onPickLibrary, onPickCamera }: DocumentUploadFieldProps) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <AppText variant="sm" weight="medium">
          {label}
        </AppText>
        {document ? (
          <Badge label={STATUS_LABEL[document.status]} tone={STATUS_TONE[document.status]} />
        ) : (
          <Badge label="Non envoyé" tone="neutral" />
        )}
      </View>

      {document?.status === 'REJECTED' && document.rejectionReason ? (
        <AppText variant="xs" color="danger" style={styles.rejectionReason}>
          {document.rejectionReason}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        {isUploading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
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
            {document?.status === 'VERIFIED' ? <IconCheck size={17} color={colors.successDark} /> : null}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm + 2,
    gap: spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rejectionReason: {
    marginTop: -2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
