// mobile/src/components/screens/OtpCodeCard.tsx
//
// Carte réutilisable pour un code de vérification (prise en charge,
// dépose, récupération de colis...) : le code est toujours envoyé par
// SMS en premier lieu, cette carte n'en affiche qu'une copie dans
// l'app pour la personne qui ne reçoit pas le SMS ou préfère ne pas
// rouvrir ses messages — avec un appui pour le copier directement
// dans le presse-papiers plutôt que de le recopier à la main.
// Un seul composant pour les 3 usages identiques (réservation
// pickup/dropoff, envoi pickup) plutôt que de dupliquer la logique.

import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { IconCheck, IconCopy, IconLock } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanButton, OceanSection } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { ApiError } from '@/services/api/ApiError';

const COPIED_LABEL_DURATION_MS = 2000;

export interface OtpCodeCardProps {
  /** Titre de la section (ex. « Code de prise en charge »). */
  title: string;
  /** Texte d'explication au-dessus du code. */
  description: string;
  code: string | undefined;
  /** false si le SMS n'a pas pu être envoyé — le code reste valable, généré et affiché indépendamment du SMS (canal best-effort en parallèle). */
  smsSent?: boolean;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  onRequest: () => void;
}

export function OtpCodeCard({
  title,
  description,
  code,
  smsSent,
  isPending,
  isError,
  error,
  onRequest,
}: OtpCodeCardProps) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Le code change à chaque nouvel envoi — un « Copié » resté affiché
  // pour l'ancien code serait trompeur.
  useEffect(() => {
    setCopied(false);
  }, [code]);

  useEffect(
    () => () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
    },
    [],
  );

  async function handleCopy() {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    setCopied(true);
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), COPIED_LABEL_DURATION_MS);
  }

  return (
    <OceanSection icon={<IconLock size={17} color={OCEAN.base} />} title={title}>
      <AppText variant="xs" color="textSecondary">
        {description}
      </AppText>

      {code ? (
        <Pressable
          onPress={handleCopy}
          accessibilityRole="button"
          accessibilityLabel="Copier le code"
          accessibilityHint="Copie le code dans le presse-papiers"
          style={({ pressed }) => [styles.codeBox, pressed && styles.pressed]}
        >
          <AppText variant="display" weight="bold" color={OCEAN.deep} style={styles.codeValue} numberOfLines={1}>
            {code}
          </AppText>
          {copied ? <IconCheck size={20} color={colors.success} /> : <IconCopy size={20} color={OCEAN.base} />}
        </Pressable>
      ) : null}

      {copied ? (
        <AppText variant="xs" weight="semibold" color={colors.success} align="center">
          Copié dans le presse-papiers
        </AppText>
      ) : code && smsSent === false ? (
        <AppText variant="xs" color={colors.accentDark} align="center">
          Le SMS n'a pas pu être envoyé, mais ce code reste valable — copiez-le directement ci-dessus.
        </AppText>
      ) : null}

      <OceanButton
        label={code ? 'Recevoir un nouveau code' : 'Voir mon code'}
        variant="soft"
        onPress={onRequest}
        loading={isPending}
      />

      {isError ? (
        <AppText variant="xs" color="danger">
          {error instanceof ApiError ? error.message : 'Impossible de récupérer le code pour le moment.'}
        </AppText>
      ) : null}
    </OceanSection>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: OCEAN.mist,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  codeValue: {
    letterSpacing: 4,
    flexShrink: 1,
  },
});