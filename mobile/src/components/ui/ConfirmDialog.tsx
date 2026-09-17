// mobile/src/components/ui/ConfirmDialog.tsx
//
// Alert.alert() ne fonctionne pas sur le web : react-native-web
// n'implémente pas de vraie boîte de dialogue native pour ce module —
// l'appel ne fait rien, silencieusement, ce qui donnait l'impression
// que le bouton "Annuler la réservation" ne réagissait pas du tout
// (voir booking/[id].tsx). Ce composant est le remplaçant
// multiplateforme : même enveloppe modale que CalendarPicker/TimePicker
// (feuille en bas sur mobile, centrée dès le seuil tablette).
//
// Usage déclaratif — l'écran appelant gère son propre état de
// visibilité (pas de host global à monter dans le layout racine, que
// je n'ai pas) :
//   const [confirmOpen, setConfirmOpen] = useState(false);
//   <ConfirmDialog
//     visible={confirmOpen}
//     title="Annuler la réservation ?"
//     message="Cette action ne peut pas être annulée."
//     confirmLabel="Annuler la réservation"
//     destructive
//     loading={cancelBooking.isPending}
//     onConfirm={() => cancelBooking.mutate(...)}
//     onCancel={() => setConfirmOpen(false)}
//   />

import React from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { AppText, Button } from '@/components/ui';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { useResponsive } from '@/hooks/useResponsive';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Bouton de confirmation en rouge (variant="danger") — pour une action irréversible ou destructive. */
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirmer',
  cancelLabel = 'Retour',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { isTablet } = useResponsive();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, isTablet && styles.sheetCentered]}>
          <AppText variant="lg" weight="semibold" style={styles.title}>
            {title}
          </AppText>
          {message ? (
            <AppText variant="sm" color="textSecondary" style={styles.message}>
              {message}
            </AppText>
          ) : null}

          <Button
            label={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            onPress={onConfirm}
            loading={loading}
            style={styles.confirmButton}
          />
          <Button label={cancelLabel} variant="secondary" onPress={onCancel} disabled={loading} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  sheetCentered: {
    maxWidth: maxContentWidth.form,
    width: '100%',
    alignSelf: 'center',
    borderBottomLeftRadius: radius.lg,
    borderBottomRightRadius: radius.lg,
  },
  title: {
    marginBottom: spacing.xxs,
  },
  message: {
    marginBottom: spacing.lg,
  },
  confirmButton: {
    marginBottom: spacing.sm,
  },
});