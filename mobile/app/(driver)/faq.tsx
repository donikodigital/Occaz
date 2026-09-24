// mobile/app/(driver)/faq.tsx
//
// v1 — Questions fréquentes côté chauffeur : accordéon simple, contenu
// reflétant les règles réellement codées (commission unique, premier
// arrivé premier servi, retrait du portefeuille) — à ajuster librement.

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
    question: 'Comment savoir si je suis éligible pour accepter des envois ?',
    answer:
      'Dès que vos documents (pièce d\'identité, permis, carte grise, assurance) sont vérifiés et acceptés, votre compte passe "Chauffeur validé" — vous pouvez alors accepter des envois, avec ou sans trajet établi.',
  },
  {
    question: 'Comment est calculée ma commission ?',
    answer:
      'Le client paie un seul montant. La commission de la plateforme, configurée par l\'admin, en est déduite — le solde vous est crédité automatiquement sur votre portefeuille dès validation de la prestation.',
  },
  {
    question: 'Pourquoi je n\'ai pas pu accepter cet envoi ?',
    answer:
      'Toutes les demandes sont envoyées à tous les chauffeurs validés en même temps : le premier à accepter l\'emporte. Si quelqu\'un a été plus rapide, la demande disparaît de votre liste.',
  },
  {
    question: 'Comment je retire l\'argent de mon portefeuille ?',
    answer:
      'Depuis l\'onglet Portefeuille, demandez un retrait : il est traité par l\'équipe support vers le moyen de paiement que vous avez renseigné.',
  },
  {
    question: 'Comment je valide une prise en charge ou une livraison ?',
    answer:
      'Un code à usage unique est envoyé au client ou à l\'expéditeur : demandez-le-lui et saisissez-le dans l\'application pour valider chaque étape.',
  },
  {
    question: 'Que se passe-t-il si un client annule ?',
    answer:
      'Le client est remboursé intégralement. Si vous aviez déjà accepté la prestation, vous en êtes averti aussitôt pour ne pas vous déplacer pour rien.',
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

export default function DriverFaqScreen() {
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
    padding: spacing.md,
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