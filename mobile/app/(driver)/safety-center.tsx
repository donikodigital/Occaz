// mobile/app/(driver)/safety-center.tsx
//
// v1 — Centre de sécurité : conseils pratiques + rappel des mécanismes de
// sécurité déjà en place dans l'app (codes de validation, notation,
// litiges). Contenu explicatif, à ajuster librement.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle, IconLock, IconMessageStar, IconPhoneCall, IconShieldCheck } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;

const TIPS: { icon: IconComponent; title: string; text: string }[] = [
  {
    icon: IconLock,
    title: 'Ne partagez jamais votre code',
    text: 'Les codes de récupération, de montée ou de livraison ne servent qu\'à valider une étape en votre présence — ne les donnez à personne par téléphone.',
  },
  {
    icon: IconMessageStar,
    title: 'Notez chaque prestation',
    text: 'Votre avis aide les autres utilisateurs et signale les chauffeurs à surveiller de plus près.',
  },
  {
    icon: IconPhoneCall,
    title: 'Restez joignable',
    text: 'Le chauffeur doit pouvoir vous contacter le jour du trajet ou de l\'envoi — vérifiez que votre numéro est à jour dans votre profil.',
  },
  {
    icon: IconAlertTriangle,
    title: 'Un problème pendant la prestation ?',
    text: 'Utilisez « Signaler un problème » depuis l\'écran du trajet ou de l\'envoi — un agent du support prend le relais.',
  },
];

export default function SafetyCenterScreen() {
  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Centre de sécurité" onBack={() => router.back()} />

      <View style={styles.hero}>
        <IconShieldCheck size={22} color={OCEAN.base} />
        <AppText variant="sm" color="textSecondary" style={styles.heroText}>
          Chaque prise en charge et chaque livraison sont validées par un code à usage unique — personne ne peut se
          faire passer pour vous ou pour votre chauffeur.
        </AppText>
      </View>

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
        label="Voir mes litiges"
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