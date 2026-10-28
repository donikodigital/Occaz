// mobile/app/(driver)/safety-center.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
//
// v1 — Centre de sécurité : conseils pratiques + rappel des mécanismes de
// sécurité déjà en place dans l'app (codes de validation, notation,
// litiges). Contenu explicatif, à ajuster librement.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconLock, IconMessageStar, IconPhoneCall, IconShieldCheck, IconUserOff, IconUsersGroup } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { SosButton } from '@/components/safety/SosButton';
import { useT, translate } from '@/i18n';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

const TIPS: { icon: IconComponent; title: string; text: string }[] = [
  {
    icon: IconLock,
    get title() { return translate('Ne partagez jamais votre code'); },
    get text() { return translate("Les codes de récupération, de montée ou de livraison ne servent qu'à valider une étape en votre présence — ne les donnez à personne par téléphone."); },
  },
  {
    icon: IconMessageStar,
    get title() { return translate('Notez chaque prestation'); },
    get text() { return translate('Votre avis aide les autres utilisateurs et signale les conducteurs à surveiller de plus près.'); },
  },
  {
    icon: IconPhoneCall,
    get title() { return translate('Restez joignable'); },
    get text() { return translate("Le conducteur doit pouvoir vous contacter le jour du trajet ou de l'envoi — vérifiez que votre numéro est à jour dans votre profil."); },
  },
  {
    icon: IconAlertTriangle,
    get title() { return translate('Un problème pendant la prestation ?'); },
    get text() { return translate("Utilisez « Signaler un problème » depuis l'écran du trajet ou de l'envoi — un agent du support prend le relais. Pour signaler ou bloquer une personne, ouvrez « Signaler ou bloquer » sur sa fiche."); },
  },
];

export default function SafetyCenterScreen() {
  const t = useT();
  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title={t('Centre de sécurité')} subtitle={t('Voyager et envoyer en confiance')} icon={<IconShieldCheck />} onBack={() => router.back()} />

      <View style={styles.hero}>
        <IconShieldCheck size={22} color={OCEAN.base} />
        <AppText variant="sm" color="textSecondary" style={styles.heroText}>
          {t('Chaque prise en charge et chaque livraison sont validées par un code à usage unique — personne ne peut se faire passer pour vous ou pour votre conducteur.')}
        </AppText>
      </View>

      <SosButton />

      <View style={styles.tips}>
        {TIPS.map((tip) => {
          const Icon = tip.icon;
          return (
            <OceanCard key={tip.title} style={styles.tipCard}>
              <View style={styles.tipIcon}>
                <Icon size={18} color={OCEAN.base} />
              </View>
              <View style={styles.tipText}>
                <AppText variant="sm" weight="semibold">
                  {tip.title}
                </AppText>
                <AppText variant="xs" color="textSecondary">
                  {tip.text}
                </AppText>
              </View>
            </OceanCard>
          );
        })}
      </View>

      <OceanButton
        label={t('Mes proches (alerte SOS)')}
        variant="soft"
        icon={<IconUsersGroup size={18} color={OCEAN.base} />}
        onPress={() => router.push('/(driver)/emergency-contacts')}
        style={styles.button}
      />

      <OceanButton
        label={t('Utilisateurs bloqués')}
        variant="soft"
        icon={<IconUserOff size={18} color={OCEAN.base} />}
        onPress={() => router.push('/(driver)/blocked-users')}
        style={styles.button}
      />

      <OceanButton
        label={t('Voir mes litiges')}
        variant="outline"
        onPress={() => router.push('/(driver)/disputes')}
        style={styles.button}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: OCEAN.mist,
    borderRadius: 18,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  heroText: {
    flex: 1,
  },
  tips: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  tipCard: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  tipIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    flex: 1,
    gap: 2,
  },
  button: {
    marginBottom: spacing.lg,
  },
});
