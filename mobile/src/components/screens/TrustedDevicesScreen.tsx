// mobile/src/components/screens/TrustedDevicesScreen.tsx
// [30/10/2026] v1 — Réglage « Téléphones de confiance », commun aux espaces Client et Conducteur.
//   Un téléphone de confiance se connecte sans code. Depuis un autre téléphone, la connexion exige un code reçu par e-mail (en priorité) ou
//   par SMS. Cet écran liste les téléphones (5 au plus), permet d'enregistrer celui-ci et de retirer n'importe lequel.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconDeviceMobile, IconDeviceMobileCheck, IconShieldCheck } from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, FeedbackBanner, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanPill, OceanSection } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { ApiError } from '@/services/api/ApiError';
import type { TrustedDeviceSummary } from '@/services/api/trustedDevice.api';
import { useTrustedDeviceStore } from '@/stores/trustedDeviceStore';
import { formatDateWithYear } from '@/utils/date';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT } from '@/i18n';

export function TrustedDevicesScreen() {
  const t = useT();
  const record = useTrustedDeviceStore((state) => state.record);
  const load = useTrustedDeviceStore((state) => state.load);
  const list = useTrustedDeviceStore((state) => state.list);
  const register = useTrustedDeviceStore((state) => state.register);
  const remove = useTrustedDeviceStore((state) => state.remove);

  const [devices, setDevices] = useState<TrustedDeviceSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [toRemove, setToRemove] = useState<TrustedDeviceSummary | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [justAdded, setJustAdded] = useState(false);

  const refresh = useCallback(async () => {
    setLoadError(undefined);
    try {
      setDevices(await list());
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : t('Impossible de charger la liste. Réessayez.'));
    }
  }, [list, t]);

  useEffect(() => {
    void load().then(refresh);
  }, [load, refresh]);

  // Le secret de ce téléphone n'est plus dans la liste (retiré depuis un autre téléphone) : l'état local est mis à jour.
  useEffect(() => {
    if (record && devices && !devices.some((device) => device.id === record.id)) {
      void useTrustedDeviceStore.getState().clear();
    }
  }, [devices, record]);

  const thisDeviceTrusted = Boolean(record) && Boolean(devices?.some((device) => device.id === record?.id));

  async function addThisPhone() {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    setJustAdded(false);
    const result = await register();
    setBusy(false);
    if (result.ok) {
      setJustAdded(true);
      await refresh();
    } else {
      setError(result.message ?? t('Une erreur est survenue. Réessayez.'));
    }
  }

  async function confirmRemove() {
    if (!toRemove) return;
    setBusy(true);
    setError(undefined);
    try {
      await remove(toRemove.id);
      setToRemove(null);
      setJustAdded(false);
      await refresh();
    } catch (err) {
      setToRemove(null);
      setError(err instanceof ApiError ? err.message : t('Une erreur est survenue. Réessayez.'));
    } finally {
      setBusy(false);
    }
  }

  const nameOf = (device: TrustedDeviceSummary) => device.label ?? (device.platform === 'ios' ? 'iPhone' : device.platform === 'android' ? t('Téléphone Android') : t('Téléphone'));

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Téléphones de confiance')} subtitle={t('Qui peut se connecter sans code')} icon={<IconDeviceMobileCheck />} onBack={() => router.back()} />

      <View style={styles.body}>
        {justAdded ? <FeedbackBanner tone="success" text={t('Ce téléphone est maintenant un téléphone de confiance.')} onDismiss={() => setJustAdded(false)} /> : null}
        {error ? <FeedbackBanner tone="error" text={error} onDismiss={() => setError(undefined)} /> : null}
        {loadError ? <FeedbackBanner tone="error" text={loadError} onDismiss={() => setLoadError(undefined)} /> : null}

        <OceanSection
          icon={<IconDeviceMobile size={17} color={OCEAN.base} />}
          title={t('Vos téléphones')}
          action={<OceanPill label={thisDeviceTrusted ? t('Ce téléphone : de confiance') : t('Ce téléphone : non enregistré')} tone={thisDeviceTrusted ? 'success' : 'neutral'} />}
        >
          {devices === null && !loadError ? (
            <ActivityIndicator color={OCEAN.base} style={styles.loader} />
          ) : devices && devices.length > 0 ? (
            <View style={styles.list}>
              {devices.map((device) => {
                const isThis = device.id === record?.id;
                return (
                  <OceanCard key={device.id} style={styles.deviceCard}>
                    <View style={styles.deviceText}>
                      <View style={styles.deviceTitleRow}>
                        <AppText variant="md" weight="semibold" color={OCEAN.deep}>
                          {nameOf(device)}
                        </AppText>
                        {isThis ? <OceanPill label={t('Ce téléphone')} tone="ocean" /> : null}
                      </View>
                      <AppText variant="xs" color="textSecondary">
                        {t('Ajouté le {date}', { date: formatDateWithYear(device.createdAt) })}
                        {device.lastUsedAt ? ` · ${t('Utilisé le {date}', { date: formatDateWithYear(device.lastUsedAt) })}` : ''}
                      </AppText>
                    </View>
                    <OceanButton label={t('Retirer')} variant="outline" onPress={() => setToRemove(device)} disabled={busy} />
                  </OceanCard>
                );
              })}
            </View>
          ) : !loadError ? (
            <AppText variant="sm" color="textSecondary" style={styles.paragraph}>
              {t('Aucun téléphone de confiance pour l’instant. Tant qu’il n’y en a pas, la question vous est posée à chaque connexion.')}
            </AppText>
          ) : null}

          {devices && !thisDeviceTrusted ? (
            <OceanButton label={t('Enregistrer ce téléphone')} onPress={() => void addThisPhone()} loading={busy} style={styles.addButton} />
          ) : null}
        </OceanSection>

        <OceanSection icon={<IconShieldCheck size={17} color={OCEAN.base} />} title={t('Votre sécurité')}>
          <AppText variant="sm" color="textSecondary" style={styles.paragraph}>
            {t('Quand vous avez un téléphone de confiance, personne ne peut ouvrir votre compte depuis un autre téléphone avec le seul mot de passe : un code vous est envoyé par e-mail (ou par SMS si vous n’avez pas d’e-mail vérifié).')}
          </AppText>
          <AppText variant="sm" color="textSecondary" style={styles.paragraph}>
            {t('Vous pouvez enregistrer jusqu’à {count} téléphones. Au-delà, le moins récemment utilisé est retiré.', { count: 5 })}
          </AppText>
          <AppText variant="sm" color="textSecondary">
            {t('Un téléphone perdu ou volé ? Retirez-le ici : il ne pourra plus se connecter sans code.')}
          </AppText>
        </OceanSection>
      </View>

      <ConfirmDialog
        visible={Boolean(toRemove)}
        title={t('Retirer ce téléphone ?')}
        message={t('Il ne sera plus un téléphone de confiance : s’y connecter demandera un code.')}
        confirmLabel={t('Retirer')}
        destructive
        loading={busy}
        onConfirm={() => void confirmRemove()}
        onCancel={() => setToRemove(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.md, gap: spacing.md },
  paragraph: { marginBottom: spacing.sm },
  loader: { paddingVertical: spacing.md },
  list: { gap: spacing.sm },
  deviceCard: { gap: spacing.sm },
  deviceText: { gap: 2 },
  deviceTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  addButton: { marginTop: spacing.sm },
});
