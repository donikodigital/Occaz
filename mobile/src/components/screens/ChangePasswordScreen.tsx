// mobile/src/components/screens/ChangePasswordScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [11/10/2026] v1 — Changer son mot de passe à 6 chiffres depuis le profil, commun aux espaces Client et Conducteur.
//   1. Mot de passe actuel  →  2. Nouveau mot de passe  →  3. Confirmation du nouveau  →  « Mot de passe modifié ».
// Les autres appareils connectés sont déconnectés par le serveur ; celui-ci reste ouvert. Un oubli se règle par « Mot de passe oublié »
// sur l'écran de connexion (il faut alors se déconnecter).
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { IconCircleCheck, IconLock } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, ScreenContainer } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { PIN_LENGTH, PinCodeInput } from '@/components/auth/PinCodeInput';
import { authApi } from '@/services/api/auth.api';
import { ApiError } from '@/services/api/ApiError';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT, translate } from '@/i18n';

type Phase = 'current' | 'new' | 'confirm' | 'done';

const COPY: Record<Exclude<Phase, 'done'>, { title: string; subtitle: string; button: string }> = {
  current: { get title() { return translate('Mot de passe actuel'); }, get subtitle() { return translate('Pour votre sécurité, saisissez d’abord le mot de passe actuel.'); }, get button() { return translate('Continuer'); } },
  new: { get title() { return translate('Nouveau mot de passe'); }, get subtitle() { return translate('6 chiffres. Évitez les suites (123456) et les chiffres répétés.'); }, get button() { return translate('Continuer'); } },
  confirm: { get title() { return translate('Confirmez le mot de passe'); }, get subtitle() { return translate('Saisissez le nouveau mot de passe une seconde fois.'); }, get button() { return translate('Enregistrer'); } },
};

export function ChangePasswordScreen() {
  const t = useT();
  const [phase, setPhase] = useState<Phase>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const change = useMutation({
    mutationFn: (vars: { currentPassword: string; newPassword: string }) => authApi.changePassword(vars.currentPassword, vars.newPassword),
  });

  function clearError() {
    setErrorMessage(undefined);
  }

  function back() {
    clearError();
    if (phase === 'new') {
      setPhase('current');
      setNext('');
    } else if (phase === 'confirm') {
      setPhase('new');
      setConfirmation('');
    } else {
      router.back();
    }
  }

  function save(confirmed: string) {
    if (confirmed !== next) {
      setErrorMessage(t('Les deux mots de passe ne sont pas identiques. Recommencez.'));
      setConfirmation('');
      return;
    }
    clearError();
    change.mutate(
      { currentPassword: current, newPassword: next },
      {
        onSuccess: () => setPhase('done'),
        onError: (error) => {
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue. Réessayez.'));
          // On repart de la saisie du mot de passe actuel : c'est lui qui est le plus souvent en cause.
          setPhase('current');
          setCurrent('');
          setNext('');
          setConfirmation('');
        },
      },
    );
  }

  function advance() {
    clearError();
    if (phase === 'current' && current.length === PIN_LENGTH) setPhase('new');
    else if (phase === 'new' && next.length === PIN_LENGTH) setPhase('confirm');
    else if (phase === 'confirm' && confirmation.length === PIN_LENGTH) save(confirmation);
  }

  if (phase === 'done') {
    return (
      <ScreenContainer maxWidth="form" footer={<OceanButton label={t('Terminé')} onPress={() => router.back()} />}>
        <View style={styles.done}>
          <AuthIllustration icon={<IconCircleCheck size={28} color={OCEAN.onDark} />} size={104} style={styles.illustration} />
          <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
            {t('Mot de passe modifié')}
          </AppText>
          <AppText variant="base" color="textSecondary" align="center">
            {t('Utilisez-le à votre prochaine connexion. Vos autres appareils ont été déconnectés.')}
          </AppText>
        </View>
      </ScreenContainer>
    );
  }

  const copy = COPY[phase];
  const value = phase === 'current' ? current : phase === 'new' ? next : confirmation;
  const setValue = phase === 'current' ? setCurrent : phase === 'new' ? setNext : setConfirmation;
  const stepNumber = phase === 'current' ? 1 : phase === 'new' ? 2 : 3;

  return (
    <ScreenContainer
      scroll
      maxWidth="form"
      footer={<OceanButton label={copy.button} onPress={advance} loading={change.isPending} disabled={value.length !== PIN_LENGTH} />}
    >
      <OceanHeroHeader title={t('Changer mon mot de passe')} subtitle={t('Étape {stepNumber} sur 3', { stepNumber })} icon={<IconLock />} onBack={back} />

      <View style={styles.body}>
        <AuthIllustration icon={<IconLock size={26} color={OCEAN.onDark} />} size={96} style={styles.illustration} />
        <AppText variant="xl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
          {copy.title}
        </AppText>
        <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
          {copy.subtitle}
        </AppText>

        {errorMessage ? <FeedbackBanner tone="error" text={errorMessage} onDismiss={clearError} /> : null}

        <PinCodeInput
          key={phase}
          value={value}
          onChange={(digits) => {
            setValue(digits);
            clearError();
          }}
          onComplete={(digits) => {
            if (phase === 'confirm') save(digits);
            else {
              clearError();
              setPhase(phase === 'current' ? 'new' : 'confirm');
            }
          }}
          hasError={Boolean(errorMessage)}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.md },
  done: { flex: 1, justifyContent: 'center' },
  illustration: { alignSelf: 'center' },
  title: { marginTop: spacing.md, marginBottom: spacing.xxs },
  subtitle: { marginBottom: spacing.lg },
});
