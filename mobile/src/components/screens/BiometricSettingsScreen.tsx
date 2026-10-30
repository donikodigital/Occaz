// mobile/src/components/screens/BiometricSettingsScreen.tsx
// [30/10/2026] v1 — Réglage « Connexion par empreinte », commun aux espaces Client et Conducteur.
//   Désactivée : « Activer » demande le mot de passe (6 chiffres) puis l'empreinte du téléphone.
//   Activée : se reconnecter d'un geste depuis l'accueil ; « Désactiver » retire l'accès de ce téléphone.
// L'empreinte elle-même ne quitte jamais le téléphone (voir services/biometric.ts).
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconFaceId, IconFingerprint, IconShieldCheck } from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, FeedbackBanner, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanPill, OceanSection } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { PIN_LENGTH, PinCodeInput } from '@/components/auth/PinCodeInput';
import { biometricName } from '@/services/biometric';
import { useBiometricStore } from '@/stores/biometricStore';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT } from '@/i18n';

export function BiometricSettingsScreen() {
  const t = useT();
  const capability = useBiometricStore((state) => state.capability);
  const record = useBiometricStore((state) => state.record);
  const load = useBiometricStore((state) => state.load);
  const reconcile = useBiometricStore((state) => state.reconcile);
  const enable = useBiometricStore((state) => state.enable);
  const disable = useBiometricStore((state) => state.disable);

  const [askingPassword, setAskingPassword] = useState(false);
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmOff, setConfirmOff] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [justEnabled, setJustEnabled] = useState(false);

  // L'état est relu à l'ouverture (l'empreinte a pu être ajoutée dans les réglages du téléphone) et comparé au serveur.
  useEffect(() => {
    void load().then(reconcile);
  }, [load, reconcile]);

  const enabled = Boolean(record);
  const Icon = capability.kind === 'face' ? IconFaceId : IconFingerprint;
  const name = biometricName(capability.kind);

  async function submit(password: string) {
    if (busy || password.length !== PIN_LENGTH) return;
    setBusy(true);
    setError(undefined);
    const result = await enable(password);
    setBusy(false);
    if (result.ok) {
      setAskingPassword(false);
      setPin('');
      setJustEnabled(true);
      return;
    }
    setPin('');
    if (result.reason === 'cancelled') setError(t('Vérification annulée. Rien n’a été activé.'));
    else if (result.reason === 'lockout') setError(t('Trop d’essais. Réessayez dans un instant.'));
    else if (result.reason === 'unavailable') setError(t('Aucune empreinte n’est disponible sur ce téléphone.'));
    else setError(result.message ?? t('Une erreur est survenue. Réessayez.'));
  }

  async function confirmDisable() {
    setBusy(true);
    await disable();
    setBusy(false);
    setConfirmOff(false);
    setJustEnabled(false);
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Connexion par empreinte')} subtitle={t('Reconnectez-vous d’un geste')} icon={<IconFingerprint />} onBack={() => router.back()} />

      <View style={styles.body}>
        {justEnabled ? (
          <FeedbackBanner tone="success" text={t('Connexion rapide activée. À votre prochaine connexion, touchez « Se connecter avec l’empreinte ».')} onDismiss={() => setJustEnabled(false)} />
        ) : null}
        {error ? <FeedbackBanner tone="error" text={error} onDismiss={() => setError(undefined)} /> : null}

        <OceanSection
          icon={<Icon size={17} color={OCEAN.base} />}
          title={t('Connexion rapide')}
          action={<OceanPill label={enabled ? t('Activée') : t('Désactivée')} tone={enabled ? 'success' : 'neutral'} />}
        >
          <AppText variant="sm" color="textSecondary" style={styles.paragraph}>
            {t('Au lieu de saisir votre mot de passe, vous vous connectez avec {biometric} de votre téléphone.', { biometric: name })}
          </AppText>

          {!capability.available ? (
            <FeedbackBanner
              tone="info"
              text={
                capability.reason === 'not_enrolled'
                  ? t('Aucune empreinte n’est enregistrée sur ce téléphone. Ajoutez-en une dans les réglages du téléphone, puis revenez ici.')
                  : t('Ce téléphone ne propose pas la connexion par empreinte.')
              }
            />
          ) : enabled ? (
            <OceanButton label={t('Désactiver sur ce téléphone')} variant="outline" onPress={() => setConfirmOff(true)} loading={busy} />
          ) : askingPassword ? (
            <View style={styles.pinBlock}>
              <AppText variant="sm" weight="semibold" color={OCEAN.deep} align="center">
                {t('Saisissez votre mot de passe pour confirmer')}
              </AppText>
              <PinCodeInput value={pin} onChange={setPin} onComplete={submit} hasError={Boolean(error)} />
              <OceanButton label={t('Activer')} onPress={() => submit(pin)} loading={busy} disabled={pin.length !== PIN_LENGTH} />
              <OceanButton label={t('Annuler')} variant="soft" onPress={() => { setAskingPassword(false); setPin(''); setError(undefined); }} />
            </View>
          ) : (
            <OceanButton label={t('Activer la connexion par empreinte')} onPress={() => { setError(undefined); setJustEnabled(false); setAskingPassword(true); }} />
          )}
        </OceanSection>

        <OceanSection icon={<IconShieldCheck size={17} color={OCEAN.base} />} title={t('Votre sécurité')}>
          <AppText variant="sm" color="textSecondary" style={styles.paragraph}>
            {t('Votre empreinte reste dans votre téléphone : l’application ne la voit jamais. Un code propre à ce téléphone est utilisé à la place de votre mot de passe, et il change à chaque connexion.')}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {t('Changer votre mot de passe ou vous déconnecter de tous les appareils désactive la connexion par empreinte sur les autres téléphones.')}
          </AppText>
        </OceanSection>
      </View>

      <ConfirmDialog
        visible={confirmOff}
        title={t('Désactiver la connexion par empreinte ?')}
        message={t('Vous devrez saisir votre mot de passe pour vous connecter sur ce téléphone.')}
        confirmLabel={t('Désactiver')}
        destructive
        loading={busy}
        onConfirm={confirmDisable}
        onCancel={() => setConfirmOff(false)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.md, gap: spacing.md },
  paragraph: { marginBottom: spacing.sm },
  pinBlock: { gap: spacing.md, paddingTop: spacing.xs },
});
