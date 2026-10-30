// mobile/app/(customer)/delete-account.tsx
// [30/10/2026] v+ — le compte supprimé n'a plus d'accès par empreinte.
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [20/10/2026] Le texte annonce l'effacement des données sous 30 jours (politique de confidentialité, section 8).
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
//
// v1 — Suppression de compte : avertissement clair, motif facultatif,
// confirmation en deux temps. L'API refuse (message affiché ici) s'il
// reste une réservation ou un envoi en cours.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconTrash } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { useDeleteAccount } from '@/hooks/useDeleteAccount';
import { useAuthStore } from '@/stores/authStore';
import { useBiometricStore } from '@/stores/biometricStore';
import { useTrustedDeviceStore } from '@/stores/trustedDeviceStore';
import { ApiError } from '@/services/api/ApiError';
import { useT } from '@/i18n';

export default function DeleteAccountScreen() {
  const t = useT();
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
        await useBiometricStore.getState().clear();
        await useTrustedDeviceStore.getState().clear();
        router.replace('/(auth)/onboarding');
      },
      onError: (error) => {
        setErrorMessage(error instanceof ApiError ? error.message : t('La suppression a échoué — réessayez.'));
        setConfirming(false);
      },
    });
  }

  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title={t('Supprimer votre compte')} subtitle={t('Lisez avant de continuer')} icon={<IconTrash />} onBack={() => router.back()} />

      <View style={styles.warning}>
        <IconAlertTriangle size={20} color={colors.dangerDark} />
        <View style={{ flex: 1 }}>
          <AppText variant="sm" weight="semibold" color={colors.dangerDark}>
            {t('Cette action est définitive')}
          </AppText>
          <AppText variant="xs" color={colors.dangerDark} style={styles.warningText}>
            {t("Votre compte sera désactivé immédiatement et vous ne pourrez plus vous connecter. Vos données personnelles seront ensuite effacées ou anonymisées sous 30 jours, sauf celles que la loi nous oblige à conserver (pièces comptables). Si une réservation ou un envoi est encore en cours, terminez-le ou annulez-le d'abord.")}
          </AppText>
        </View>
      </View>

      <TextField
        label={t('Pourquoi partez-vous ? (optionnel)')}
        value={reason}
        onChangeText={setReason}
        placeholder={t('Votre retour nous aide à nous améliorer')}
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
          label={t('Supprimer mon compte')}
          variant="danger"
          icon={<IconTrash size={17} color={colors.onPrimary} />}
          onPress={() => setConfirming(true)}
          style={styles.button}
        />
      ) : (
        <View style={styles.confirmRow}>
          <AppText variant="sm" weight="semibold" color={colors.dangerDark} align="center" style={styles.confirmText}>
            {t('Confirmez-vous la suppression définitive de votre compte ?')}
          </AppText>
          <OceanButton
            label={t('Oui, supprimer définitivement')}
            variant="danger"
            onPress={handleConfirm}
            loading={deleteAccount.isPending}
            style={styles.button}
          />
          <OceanButton label={t('Annuler')} variant="outline" onPress={() => setConfirming(false)} style={styles.button} />
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
