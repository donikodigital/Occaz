// mobile/app/(driver)/faq.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
//
// v1 — Questions fréquentes côté conducteur : accordéon simple, contenu
// reflétant les règles réellement codées (commission unique, premier
// arrivé premier servi, retrait du portefeuille) — à ajuster librement.

import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconChevronDown, IconQuestionMark } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanCard } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useT, translate } from '@/i18n';

const QUESTIONS: { question: string; answer: string }[] = [
  {
    get question() { return translate('Comment savoir si je suis éligible pour accepter des envois ?'); },
    get answer() { return translate('Dès que vos documents (pièce d\'identité, permis, carte grise, assurance) sont vérifiés et acceptés, votre compte passe "Conducteur validé" — vous pouvez alors accepter des envois, avec ou sans trajet établi.'); },
  },
  {
    get question() { return translate('Comment est calculée ma commission ?'); },
    get answer() { return translate("Le client paie un seul montant. La commission de la plateforme, configurée par l'admin, en est déduite — le solde vous est crédité automatiquement sur votre portefeuille dès validation de la prestation."); },
  },
  {
    get question() { return translate("Pourquoi je n'ai pas pu accepter cet envoi ?"); },
    get answer() { return translate("Toutes les demandes sont envoyées à tous les conducteurs validés en même temps : le premier à accepter l'emporte. Si quelqu'un a été plus rapide, la demande disparaît de votre liste."); },
  },
  {
    get question() { return translate("Comment je retire l'argent de mon portefeuille ?"); },
    get answer() { return translate("Depuis l'onglet Portefeuille, demandez un retrait : il est traité par l'équipe support vers le moyen de paiement que vous avez renseigné."); },
  },
  {
    get question() { return translate('Comment je valide une prise en charge ou une livraison ?'); },
    get answer() { return translate("Un code à usage unique est envoyé au client ou à l'expéditeur : demandez-le-lui et saisissez-le dans l'application pour valider chaque étape."); },
  },
  {
    get question() { return translate('Que se passe-t-il si un client annule ?'); },
    get answer() { return translate('Le client est remboursé intégralement. Si vous aviez déjà accepté la prestation, vous en êtes averti aussitôt pour ne pas vous déplacer pour rien.'); },
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
  const t = useT();
  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanHeroHeader title={t('Questions fréquentes')} subtitle={t('Les réponses à vos questions')} icon={<IconQuestionMark />} onBack={() => router.back()} />

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
