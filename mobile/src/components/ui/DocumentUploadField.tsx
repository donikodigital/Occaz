// mobile/src/components/ui/DocumentUploadField.tsx
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { IconAlertCircle, IconCamera, IconFileText, IconPhoto } from '@tabler/icons-react-native';
import { AppText } from './AppText';
import { Badge } from './Badge';
import type { BadgeTone } from './Badge';
import { colors, radius, spacing } from '@/theme';
import type { AppDocument } from '@/types/documents.types';

export interface DocumentUploadFieldProps {
  label: string;
  document?: AppDocument;
  isUploading: boolean;
  onPickLibrary: () => void;
  onPickCamera: () => void;
}

/** Statut affiché : celui du document, ou MISSING tant que rien n'a été envoyé. */
type DisplayState = AppDocument['status'] | 'MISSING';

const STATE_LABEL: Record<DisplayState, string> = {
  MISSING: 'Non envoyé',
  PENDING: 'En vérification',
  VERIFIED: 'Vérifié',
  REJECTED: 'Rejeté',
};
const STATE_TONE: Record<DisplayState, BadgeTone> = {
  MISSING: 'neutral',
  PENDING: 'accent',
  VERIFIED: 'success',
  REJECTED: 'danger',
};
/** Couleurs de la pastille d'icône : elle porte le statut d'un coup d'œil, avant même de lire le badge. */
const STATE_TILE: Record<DisplayState, { background: string; icon: string }> = {
  MISSING: { background: colors.surfaceMuted, icon: colors.textSecondary },
  PENDING: { background: colors.accentLight, icon: colors.accentDark },
  VERIFIED: { background: colors.successLight, icon: colors.successDark },
  REJECTED: { background: colors.dangerLight, icon: colors.dangerDark },
};

function ActionButton({
  icon,
  label,
  accessibilityLabel,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
    >
      {icon}
      <AppText variant="sm" weight="semibold">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Un champ par type de pièce (CNI, permis, carte grise...) — la même pièce peut être renvoyée si rejetée, un nouvel envoi remplace simplement l'ancien statut à l'écran suivant. */
export function DocumentUploadField({ label, document, isUploading, onPickLibrary, onPickCamera }: DocumentUploadFieldProps) {
  const state: DisplayState = document?.status ?? 'MISSING';
  const tile = STATE_TILE[state];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconTile, { backgroundColor: tile.background }]}>
          <IconFileText size={20} color={tile.icon} stroke={1.8} />
        </View>
        <AppText variant="sm" weight="semibold" style={styles.title}>
          {label}
        </AppText>
        <Badge label={STATE_LABEL[state]} tone={STATE_TONE[state]} />
      </View>

      {state === 'REJECTED' && document?.rejectionReason ? (
        <View style={styles.rejection}>
          <IconAlertCircle size={16} color={colors.dangerDark} />
          <AppText variant="xs" color="dangerDark" style={styles.rejectionText}>
            {document.rejectionReason}
          </AppText>
        </View>
      ) : null}

      {isUploading ? (
        <View style={styles.uploading}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="sm" color="textSecondary">
            Envoi en cours…
          </AppText>
        </View>
      ) : (
        <View style={styles.actions}>
          <ActionButton
            icon={<IconPhoto size={17} color={colors.textPrimary} />}
            label="Galerie"
            accessibilityLabel="Choisir depuis la galerie"
            onPress={onPickLibrary}
          />
          <ActionButton
            icon={<IconCamera size={17} color={colors.textPrimary} />}
            label="Photo"
            accessibilityLabel="Prendre une photo"
            onPress={onPickCamera}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
  },
  rejection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
  },
  rejectionText: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  action: {
    flex: 1,
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  actionPressed: {
    opacity: 0.7,
  },
  uploading: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});