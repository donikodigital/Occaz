// mobile/src/components/ui/DocumentUploadField.tsx
// [23/10/2026] v+ — onDelete : bouton « Supprimer ce document » (avec confirmation) tant que la pièce n'est pas vérifiée. Une pièce vérifiée
// ne se supprime pas : un petit texte invite à en renvoyer une nouvelle.
// [10/10/2026] v+ — errorMessage : l'échec d'un envoi s'affiche sous le champ (Alert.alert ne fait rien sur le web).
// [21/09/2026] v+ — strokeWidth au lieu de stroke.
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { IconAlertCircle, IconCamera, IconFileText, IconPhoto, IconTrash } from '@tabler/icons-react-native';
import { AppText } from './AppText';
import { Badge } from './Badge';
import { ConfirmDialog } from './ConfirmDialog';
import { FeedbackBanner } from './FeedbackBanner';
import type { BadgeTone } from './Badge';
import { colors, radius, spacing } from '@/theme';
import type { AppDocument } from '@/types/documents.types';

export interface DocumentUploadFieldProps {
  label: string;
  document?: AppDocument;
  isUploading: boolean;
  onPickLibrary: () => void;
  onPickCamera: () => void;
  /** Échec du dernier envoi de cette pièce, affiché sous le champ. */
  errorMessage?: string | null;
  /** Supprime la pièce envoyée. Sans cette fonction, aucun bouton de suppression n'est affiché. */
  onDelete?: () => void;
  isDeleting?: boolean;
  /** Échec de la dernière suppression, affiché sous le champ. */
  deleteError?: string | null;
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
export function DocumentUploadField({
  label,
  document,
  isUploading,
  onPickLibrary,
  onPickCamera,
  errorMessage,
  onDelete,
  isDeleting = false,
  deleteError,
}: DocumentUploadFieldProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const state: DisplayState = document?.status ?? 'MISSING';
  const canDelete = Boolean(onDelete && document && state !== 'VERIFIED');
  const tile = STATE_TILE[state];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={[styles.iconTile, { backgroundColor: tile.background }]}>
          <IconFileText size={20} color={tile.icon} strokeWidth={1.8} />
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

      {canDelete && !isUploading ? (
        <Pressable
          onPress={() => setConfirmingDelete(true)}
          disabled={isDeleting}
          accessibilityRole="button"
          accessibilityLabel={`Supprimer le document : ${label}`}
          style={({ pressed }) => [styles.deleteButton, (pressed || isDeleting) && styles.actionPressed]}
        >
          {isDeleting ? <ActivityIndicator size="small" color={colors.dangerDark} /> : <IconTrash size={16} color={colors.dangerDark} />}
          <AppText variant="sm" weight="semibold" color="dangerDark">
            {isDeleting ? 'Suppression…' : 'Supprimer ce document'}
          </AppText>
        </Pressable>
      ) : null}

      {onDelete && document && state === 'VERIFIED' ? (
        <AppText variant="xs" color="textMuted">
          Document vérifié : pour le changer, envoyez-en un nouveau.
        </AppText>
      ) : null}

      {errorMessage ? <FeedbackBanner tone="error" text={errorMessage} /> : null}
      {deleteError ? <FeedbackBanner tone="error" text={deleteError} /> : null}

      <ConfirmDialog
        visible={confirmingDelete}
        title="Supprimer ce document ?"
        message="Le fichier envoyé sera effacé. Vous pourrez en envoyer un autre à tout moment."
        confirmLabel="Supprimer"
        destructive
        loading={isDeleting}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete?.();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
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
  deleteButton: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.dangerLight,
  },
  uploading: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
});