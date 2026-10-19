// mobile/src/components/screens/PhoneChangeScreen.tsx
// [19/10/2026] v+ — Le code part TOUJOURS par SMS au nouveau numéro ; l'avertissement du changement part par e-mail (plus de SMS à l'ancien numéro).
// [19/10/2026] v+ — Quand le serveur annonce le changement de numéro fermé (SMS coupé par défaut), l'écran l'explique au lieu de laisser échouer l'envoi.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
//
// Changement de numéro de téléphone, commun aux espaces Client et Conducteur (les deux écrans de route le réutilisent).
//
//   1. Nouveau numéro  → un code est envoyé par SMS à ce NOUVEAU numéro (preuve que la personne le possède) ;
//   2. Code à 6 chiffres → saisi, il remplace le numéro du compte ; si le compte a une adresse e-mail, elle est prévenue du changement ;
//   3. Confirmation.
//
// Le numéro est l'identifiant de connexion : après le changement, on se connecte avec le nouveau. Le numéro Mobile Money d'un
// conducteur est un réglage distinct (profil) et ne change pas ici.
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCircleCheck, IconDeviceMobile, IconMessage2 } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { LockedField } from '@/components/screens/LockedField';
import { OTP_CODE_LENGTH, OtpCodeInput } from '@/components/screens/OtpCodeInput';
import { useConfirmPhoneChange, useRequestPhoneChange } from '@/hooks/usePhoneChange';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useAuthStore } from '@/stores/authStore';
import { ApiError } from '@/services/api/ApiError';
import { guessCountryPrefix, isValidPhoneNumber, normalizePhoneInput } from '@/utils/phone';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

const RESEND_COOLDOWN_SECONDS = 45;

type Step = 'number' | 'code' | 'done';

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.';
}

export function PhoneChangeScreen() {
  const currentPhone = useAuthStore((state) => state.user?.phone ?? '');
  const { data: appConfig } = useAppConfig();

  const [step, setStep] = useState<Step>('number');
  // Pré-rempli avec l'indicatif du pays du numéro actuel : on ne tape que la suite.
  const [newPhone, setNewPhone] = useState(() => guessCountryPrefix(currentPhone));
  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [cooldown, setCooldown] = useState(0);

  const requestChange = useRequestPhoneChange();
  const confirmChange = useConfirmPhoneChange();

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function sendCode() {
    setErrorMessage(undefined);
    const phone = newPhone.trim();
    if (!isValidPhoneNumber(phone)) {
      setErrorMessage('Saisissez le numéro au format international, par exemple +224620000000.');
      return;
    }
    if (phone === currentPhone) {
      setErrorMessage("C'est déjà le numéro de votre compte.");
      return;
    }
    requestChange.mutate(phone, {
      onSuccess: () => {
        setCode('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setStep('code');
      },
      onError: (error) => setErrorMessage(errorText(error)),
    });
  }

  function resendCode() {
    setErrorMessage(undefined);
    requestChange.mutate(newPhone.trim(), {
      onSuccess: () => {
        setCode('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
      },
      onError: (error) => setErrorMessage(errorText(error)),
    });
  }

  function verify(codeToVerify: string) {
    if (codeToVerify.length !== OTP_CODE_LENGTH || confirmChange.isPending) return;
    setErrorMessage(undefined);
    confirmChange.mutate(
      { newPhone: newPhone.trim(), code: codeToVerify },
      {
        onSuccess: () => setStep('done'),
        onError: (error) => {
          setErrorMessage(errorText(error));
          setCode('');
        },
      },
    );
  }

  function backToNumber() {
    setErrorMessage(undefined);
    setCode('');
    setStep('number');
  }

  // ---------------------------------------------------------------------------

  if (step === 'number' && appConfig?.features.phoneChange === false) {
    return (
      <ScreenContainer scroll maxWidth="form">
        <OceanHeroHeader title="Changer mon numéro" icon={<IconDeviceMobile />} onBack={() => router.back()} />
        <View style={styles.body}>
          <AuthIllustration icon={<IconDeviceMobile size={26} color={OCEAN.onDark} />} size={104} style={styles.illustration} />
          <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
            Le changement de numéro en ligne n&apos;est pas disponible pour le moment. Contactez le support Occa&apos;Z : il le fera pour vous après vérification de votre identité.
          </AppText>
        </View>
        <OceanButton label="Retour" variant="soft" onPress={() => router.back()} style={styles.submit} />
      </ScreenContainer>
    );
  }

  if (step === 'done') {
    return (
      <ScreenContainer maxWidth="form">
        <View style={styles.centered}>
          <AuthIllustration icon={<IconCircleCheck size={28} color={OCEAN.onDark} />} size={104} style={styles.illustration} />
          <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
            Numéro modifié
          </AppText>
          <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
            Votre compte utilise maintenant le {newPhone.trim()}. Utilisez ce numéro pour vous connecter.
          </AppText>
          <AppText variant="xs" color="textMuted" align="center">
            Si votre compte a une adresse e-mail, nous l'avons prévenue du changement.
          </AppText>
        </View>
        <OceanButton label="Terminé" onPress={() => router.back()} style={styles.submit} />
      </ScreenContainer>
    );
  }

  if (step === 'code') {
    return (
      <ScreenContainer maxWidth="form">
        <OceanHeroHeader title="Changer mon numéro" subtitle="Étape 2 sur 2" icon={<IconMessage2 />} onBack={backToNumber} />

        <View style={styles.body}>
          <AuthIllustration icon={<IconMessage2 size={26} color={OCEAN.onDark} />} size={104} style={styles.illustration} />
          <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
            Entrez le code
          </AppText>
          <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
            Code envoyé par SMS au {newPhone.trim()}
          </AppText>

          <OtpCodeInput
            value={code}
            onChange={(next) => {
              setCode(next);
              setErrorMessage(undefined);
            }}
            onComplete={verify}
            hasError={Boolean(errorMessage)}
          />

          {errorMessage ? (
            <AppText variant="sm" color="danger" align="center" style={styles.error}>
              {errorMessage}
            </AppText>
          ) : null}

          <View style={styles.links}>
            {cooldown > 0 ? (
              <AppText variant="sm" color="textMuted">
                Renvoyer le code dans {cooldown}s
              </AppText>
            ) : (
              <Pressable onPress={resendCode} disabled={requestChange.isPending} accessibilityRole="button">
                <AppText variant="sm" weight="semibold" color={OCEAN.base}>
                  Renvoyer le code
                </AppText>
              </Pressable>
            )}
            <Pressable onPress={backToNumber} accessibilityRole="button">
              <AppText variant="sm" weight="semibold" color={OCEAN.base}>
                Ce n'est pas le bon numéro ? Le modifier
              </AppText>
            </Pressable>
          </View>
        </View>

        <OceanButton
          label="Vérifier"
          onPress={() => verify(code)}
          loading={confirmChange.isPending}
          disabled={code.length !== OTP_CODE_LENGTH}
          style={styles.submit}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title="Changer mon numéro" subtitle="Étape 1 sur 2" icon={<IconDeviceMobile />} onBack={() => router.back()} />

      <View style={styles.body}>
        <AuthIllustration icon={<IconDeviceMobile size={26} color={OCEAN.onDark} />} size={104} style={styles.illustration} />
        <AppText variant="base" color="textSecondary" align="center" style={styles.subtitle}>
          Saisissez votre nouveau numéro : nous y enverrons un code par SMS pour vérifier qu'il est bien à vous.
        </AppText>

        <View style={styles.fields}>
          <LockedField label="Numéro actuel" value={currentPhone} />
          <TextField
            label="Nouveau numéro"
            value={newPhone}
            onChangeText={(text) => {
              setNewPhone(normalizePhoneInput(text));
              setErrorMessage(undefined);
            }}
            keyboardType="phone-pad"
            placeholder="+224620000000"
            autoFocus
            error={errorMessage}
          />
        </View>

        <AppText variant="xs" color="textMuted" style={styles.note}>
          Ce numéro devient votre identifiant de connexion. Si votre compte a une adresse e-mail, elle sera prévenue du changement.
          Un nouveau changement ne sera possible qu'après un délai. Le numéro Mobile Money d'un conducteur n'est pas modifié ici.
        </AppText>
      </View>

      <OceanButton
        label="Recevoir le code"
        onPress={sendCode}
        loading={requestChange.isPending}
        disabled={newPhone.trim().length < 8}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingTop: spacing.md,
    gap: spacing.sm,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  illustration: {
    alignSelf: 'center',
  },
  title: {
    marginTop: spacing.md,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  fields: {
    gap: spacing.md,
  },
  note: {
    marginTop: spacing.sm,
  },
  error: {
    marginTop: spacing.sm,
    color: colors.danger,
  },
  links: {
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  submit: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
});
