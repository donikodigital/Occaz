// mobile/app/(customer)/faq.tsx
//
// v1 — Questions fréquentes : accordéon simple, contenu reflétant les
// règles réellement codées (annulation à 100 %, premier arrivé premier
// servi, etc.) — à ajuster librement.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronDown } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanCard, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

const QUESTIONS: { question: string; answer: string }[] = [
  {
    question: 'Comment est calculé le prix d\'un envoi ?',
    answer:
      'Le prix dépend du poids (ou du poids volumétrique s\'il est plus grand), de la distance, de la catégorie du colis et d\'une éventuelle valeur déclarée. Il est calculé automatiquement et affiché avant paiement.',
  },
  {
    question: 'Qui accepte ma demande d\'envoi ?',
    answer:
      'Tous les chauffeurs validés sont prévenus en même temps, avec ou sans trajet établi. Le premier à accepter s\'en charge — vous êtes averti dès qu\'un chauffeur est trouvé.',
  },
  {
    question: 'Que se passe-t-il si aucun chauffeur n\'accepte avant la fin de ma période ?',
    answer:
      'Vous êtes invité à prolonger votre demande. Si vous ne répondez pas, ou si vous préférez annuler, vous êtes remboursé intégralement.',
  },
  {
    question: 'Puis-je annuler une réservation ou un envoi payé ?',
    answer: 'Oui, tant que le colis n\'a pas été récupéré ou que le trajet n\'a pas commencé. Le remboursement est intégral.',
  },
  {
    question: 'Comment le chauffeur valide-t-il la prise en charge ou la livraison ?',
    answer:
      'Un code à usage unique vous est envoyé par SMS à chaque étape (montée, descente, récupération, livraison) : vous le donnez au chauffeur pour valider.',
  },
  {
    question: 'Quels moyens de paiement sont acceptés ?',
    answer: 'Le paiement se fait via les moyens configurés dans votre pays (mobile money, carte bancaire...), en une seule fois.',
  },
];

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <OceanCard style={styles.item}>
      <Pressable onPress={() => setOpen((v) => !v)} accessibilityRole="button" style={styles.itemHeader}>
        <AppText variant="sm" weight="semibold" style={styles.itemQuestion}>
          {question}
        </AppText>
        <View style={[styles.chevron, isOpen && styles.chevronOpen]}>
          <IconChevronDown size={16} color={OCEAN.base} />
        </View>
      </Pressable>
      {isOpen ? (
        <AppText variant="sm" color="textSecondary" style={styles.answer}>
          {answer}
        </AppText>
      ) : null}
    </OceanCard>
  );
}

export default function FaqScreen() {
  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Questions fréquentes" onBack={() => router.back()} />

      <View style={styles.list}>
        {QUESTIONS.map((item) => (
          <FaqItem key={item.question} {...item} />
        ))}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  item: {
    gap: spacing.xs,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  itemQuestion: {
    flex: 1,
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronOpen: {
    transform: [{ rotate: '180deg' }],
  },
  answer: {
    paddingTop: 2,
  },
});