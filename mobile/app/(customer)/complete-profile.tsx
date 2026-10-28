// mobile/app/(customer)/complete-profile.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
//
// [19/10/2026] v2b — bouton « Retour » en haut de l'écran (vers l'espace conducteur si le compte en a un, sinon vers l'écran précédent).
// v2 — Habillage bleu océan : un bandeau d'accueil sombre, le formulaire sur
// une carte à en-tête soulignée, et le bouton plein. Logique inchangée.
//
// Étape obligatoire après la toute première connexion (section 57) : le
// compte User existe mais aucun CustomerProfile n'est encore rattaché
// (POST /customer-profiles/me côté backend, Lot 2). Sans cet écran,
// l'app resterait bloquée sur un accueil qui ne peut rien afficher.

import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowLeft, IconUserCircle, IconUserPlus } from '@tabler/icons-react-native';
import { AppText, IconButton, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanHeroCard, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCreateCustomerProfile } from '@/hooks/useCustomerProfile';
import { useProfileStepBack } from '@/hooks/useProfileStepBack';
import { ApiError } from '@/services/api/ApiError';
import { useT } from '@/i18n';

export default function CompleteProfileScreen() {
  const t = useT();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const createProfile = useCreateCustomerProfile();
  const goBack = useProfileStepBack('CUSTOMER');

  function handleSubmit() {
    setErrorMessage(undefined);
    if (firstName.trim().length < 2 || lastName.trim().length < 2) {
      setErrorMessage(t('Renseignez votre prénom et votre nom.'));
      return;
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setErrorMessage(t('Adresse email invalide.'));
      return;
    }
    createProfile.mutate(
      { firstName: firstName.trim(), lastName: lastName.trim(), email: trimmedEmail || undefined },
      {
        onSuccess: () => router.replace('/(customer)/(tabs)/home'),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue.'));
        },
      },
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <View style={styles.body}>
        {goBack ? (
          <View style={styles.topBar}>
            <IconButton icon={<IconArrowLeft size={18} color={colors.textPrimary} />} accessibilityLabel={t('Retour')} onPress={goBack} />
          </View>
        ) : null}
        <OceanHeroCard style={styles.hero}>
          <View style={styles.heroIcon}>
            <IconUserPlus size={26} color={OCEAN.onDark} />
          </View>
          <AppText variant="xxl" weight="bold" color={OCEAN.onDark}>
            {t('Complétez votre')}{' '}<AppText variant="xxl" weight="bold" color={OCEAN.gold}>{t('profil')}</AppText>
          </AppText>
          <AppText variant="sm" color={OCEAN.sky}>
            {t('Ces informations sont partagées avec votre conducteur au moment de la réservation.')}
          </AppText>
        </OceanHeroCard>

        <OceanSection icon={<IconUserCircle size={17} color={OCEAN.base} />} title={t('Vos informations')}>
          <TextField label={t('Prénom')} value={firstName} onChangeText={setFirstName} placeholder={t('Fatoumata')} autoFocus />
          <TextField label={t('Nom')} value={lastName} onChangeText={setLastName} placeholder={t('Diallo')} />
          <TextField
            label={t('Email (optionnel)')}
            value={email}
            onChangeText={setEmail}
            placeholder={t('vous@exemple.com')}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <AppText variant="xs" color="textMuted">
            {t('Pour recevoir aussi vos notifications par email.')}
          </AppText>
        </OceanSection>

        {errorMessage ? (
          <AppText variant="sm" color="danger" style={styles.error}>
            {errorMessage}
          </AppText>
        ) : null}
      </View>

      <OceanButton label={t('Continuer')} onPress={handleSubmit} loading={createProfile.isPending} style={styles.submit} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingTop: spacing.lg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  hero: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  error: {
    marginBottom: spacing.sm,
  },
  submit: {
    marginBottom: spacing.lg,
  },
});