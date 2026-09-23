// mobile/app/(customer)/delete-account.tsx
//
// v1 — Suppression de compte : avertissement clair, motif facultatif,
// confirmation en deux temps. L'API refuse (message affiché ici) s'il
// reste une réservation ou un envoi en cours.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';

export default function DeleteAccountScreen() {
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const deleteAccount = useDeleteAccount();
  const logout = useAuthStore((state) => state.logout);

  function handleConfirm() {
    setErrorMessage(undefined);
    deleteAccount.mutate(reason.trim() || undefined, {
      onSuccess: async () => {
        await logout();
        router.replace('/(auth)/onboarding');
      },
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : 'La suppression a échoué — réessayez.');
        setConfirming(false);
      },
    });
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Supprimer votre compte" onBack={() => router.back()} />

      <View style={styles.warning}>
        <IconAlertTriangle size={20} color={colors.dangerDark} />
        <View style={{ flex: 1 }}>
          <AppText variant="sm" weight="semibold" color={colors.dangerDark}>
            Cette action est définitive
          </AppText>
          <AppText variant="xs" color={colors.dangerDark} style={styles.warningText}>
            Votre compte sera désactivé et vous ne pourrez plus vous connecter. Si une réservation ou un envoi est
            encore en cours, terminez-le ou annulez-le d'abord.
          </AppText>
        </View>
      </View>

      <TextField
        label="Pourquoi partez-vous ? (optionnel)"
        value={reason}
        onChangeText={setReason}
        placeholder="Votre retour nous aide à nous améliorer"
        multiline
        style={styles.reasonInput}
      />

      {errorMessage ? (
        <AppText variant="sm" color="danger" style={styles.error}>
          {errorMessage}
        </AppText>
      ) : null}

      {!confirming ? (
        <OceanButton
          label="Supprimer mon compte"
          variant="danger"
          icon={<IconTrash size={17} color={colors.onPrimary} />}
          onPress={() => setConfirming(true)}
          style={styles.button}
        />
      ) : (
        <View style={styles.confirmRow}>
          <AppText variant="sm" weight="semibold" color={colors.dangerDark} align="center" style={styles.confirmText}>
            Confirmez-vous la suppression définitive de votre compte ?
          </AppText>
          <OceanButton
            label="Oui, supprimer définitivement"
            variant="danger"
            onPress={handleConfirm}
            loading={deleteAccount.isPending}
            style={styles.button}
          />
          <OceanButton label="Annuler" variant="outline" onPress={() => setConfirming(false)} style={styles.button} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.dangerLight,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  warningText: {
    marginTop: 2,
  },
  reasonInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  error: {
    marginBottom: spacing.sm,
  },
  confirmRow: {
    gap: spacing.sm,
  },
  confirmText: {
    marginBottom: spacing.xs,
  },
  button: {
    marginBottom: spacing.md,
  },
});