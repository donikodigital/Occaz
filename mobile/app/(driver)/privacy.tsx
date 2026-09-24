// mobile/app/(driver)/privacy.tsx
//
// v1 — Protection des données : brouillon à remplacer par Doniko (ou un
// juriste), basé sur la Loi L/2016/037/AN relative à la cyber-sécurité et
// à la protection des données à caractère personnel en République de
// Guinée. Le bandeau d'avertissement en haut de l'écran doit disparaître
// une fois le texte définitif en place.

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconAlertTriangle } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { OceanScreenHeader } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';

function Article({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.article}>
      <AppText variant="sm" weight="bold" color={OCEAN.deep}>
        {title}
      </AppText>
      <AppText variant="sm" color="textSecondary" style={styles.paragraph}>
        {children}
      </AppText>
    </View>
  );
}

export default function PrivacyScreen() {
  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Protection des données" onBack={() => router.back()} />

      <View style={styles.warning}>
        <IconAlertTriangle size={16} color={colors.dangerDark} />
        <AppText variant="xs" color={colors.dangerDark} style={{ flex: 1 }}>
          Brouillon à faire valider par un juriste avant mise en production — remplacez ce texte.
        </AppText>
      </View>

      <AppText variant="xs" color="textMuted" style={styles.updated}>
        Dernière mise à jour : à compléter
      </AppText>

      <Article title="Préambule">
        La présente politique répond aux exigences de la Loi L/2016/037/AN relative à la cyber-sécurité et à la
        protection des données à caractère personnel en République de Guinée. Elle explique quelles données Occaz
        collecte, pourquoi, et comment exercer vos droits.
      </Article>

      <Article title="1. Données collectées">
        Identité (nom, prénom, date de naissance), coordonnées (téléphone, email), documents d'identité et
        justificatifs pour les chauffeurs (permis, carte grise, assurance), données de localisation lors d'un trajet
        en cours, historique de réservations et d'envois, données de paiement limitées (référence de transaction —
        jamais le numéro complet d'une carte ni son cryptogramme).
      </Article>

      <Article title="2. Finalités du traitement">
        Ces données servent à créer et sécuriser votre compte, mettre en relation chauffeurs et clients, calculer
        les prix, traiter les paiements, assurer le suivi d'un trajet ou d'un envoi, gérer les litiges et notations,
        et respecter nos obligations légales.
      </Article>

      <Article title="3. Base légale du traitement">
        Le traitement repose selon les cas sur votre consentement (donné à l'inscription), sur l'exécution du
        contrat qui vous lie à Occaz lorsque vous réservez un trajet ou un envoi, et sur le respect d'obligations
        légales (conservation de certaines données à des fins comptables ou réglementaires).
      </Article>

      <Article title="4. Destinataires des données">
        Vos données sont accessibles à l'équipe Occaz habilitée, au chauffeur ou au client concerné par une
        prestation donnée (dans la limite nécessaire à son bon déroulement), et à nos sous-traitants techniques
        (hébergement, prestataires de paiement, envoi de SMS). Elles ne sont jamais vendues à des tiers à des fins
        commerciales.
      </Article>

      <Article title="5. Durée de conservation">
        Les données sont conservées pendant la durée de votre compte, puis archivées le temps nécessaire au respect
        de nos obligations légales et comptables, avant suppression ou anonymisation.
      </Article>

      <Article title="6. Sécurité des données">
        Occaz met en œuvre des mesures techniques et organisationnelles raisonnables pour protéger vos données
        contre l'accès non autorisé, la perte ou la divulgation, conformément à la Loi L/2016/037/AN.
      </Article>

      <Article title="7. Vos droits">
        Vous disposez d'un droit d'accès, de rectification et, dans les limites prévues par la loi, de suppression
        de vos données. Vous pouvez également vous opposer à une utilisation de vos données à des fins de
        prospection commerciale. Pour exercer ces droits, contactez-nous à l'adresse ci-dessous, ou supprimez
        directement votre compte depuis l'application.
      </Article>

      <Article title="8. Cookies et traceurs">
        Le site web de l'administration Occaz utilise des cookies techniques nécessaires à son fonctionnement, et,
        le cas échéant, des cookies de mesure d'audience soumis à votre consentement, recueilli via le bandeau prévu
        à cet effet.
      </Article>

      <Article title="9. Contact">
        Pour toute question relative à cette politique ou à vos données personnelles : Doniko.digital@gmail.com
      </Article>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  warning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    backgroundColor: colors.dangerLight,
    borderRadius: 14,
    padding: spacing.sm + 2,
    marginBottom: spacing.sm,
  },
  updated: {
    marginBottom: spacing.lg,
  },
  article: {
    gap: 4,
    marginBottom: spacing.md,
  },
  paragraph: {
    lineHeight: 20,
  },
});