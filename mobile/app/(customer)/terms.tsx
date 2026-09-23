// mobile/app/(customer)/terms.tsx
//
// v1 — Conditions générales : brouillon à remplacer par Doniko (ou un
// juriste), basé sur la loi guinéenne relative aux transactions
// électroniques (2016, décret d'application 2021, régulateur ARPT) et sur
// les Actes uniformes OHADA (Guinée membre) pour le droit commercial. Le
// bandeau d'avertissement en haut de l'écran doit disparaître une fois le
// texte définitif en place.

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

export default function TermsScreen() {
  return (
    <ScreenContainer scroll maxWidth="detail">
      <OceanScreenHeader title="Conditions générales" onBack={() => router.back()} />

      <View style={styles.warning}>
        <IconAlertTriangle size={16} color={colors.dangerDark} />
        <AppText variant="xs" color={colors.dangerDark} style={{ flex: 1 }}>
          Brouillon à faire valider par un juriste avant mise en production — remplacez ce texte.
        </AppText>
      </View>

      <AppText variant="xs" color="textMuted" style={styles.updated}>
        Dernière mise à jour : à compléter
      </AppText>

      <Article title="1. Objet">
        Les présentes conditions générales régissent l'utilisation de l'application Occaz, plateforme de mise en
        relation entre chauffeurs et particuliers pour le covoiturage de personnes et le transport de colis en
        République de Guinée. En créant un compte, vous acceptez ces conditions.
      </Article>

      <Article title="2. Nature du service">
        Occaz agit en tant qu'intermédiaire technique. La société n'est ni transporteur, ni loueur de véhicules :
        chaque trajet et chaque envoi sont assurés directement entre le chauffeur et le client, dans le cadre d'un
        contrat de transport conclu entre eux via la plateforme.
      </Article>

      <Article title="3. Inscription et compte">
        L'inscription requiert un numéro de téléphone valide, vérifié par code SMS. Chaque utilisateur est
        responsable de l'exactitude des informations fournies et de la confidentialité de son accès. Les chauffeurs
        doivent en outre transmettre les documents requis (pièce d'identité, permis, carte grise, assurance) avant
        toute activité.
      </Article>

      <Article title="4. Réservations, envois et paiement">
        Le prix d'une réservation ou d'un envoi est calculé et affiché avant paiement. Le paiement s'effectue par les
        moyens proposés dans l'application (mobile money, carte bancaire selon disponibilité), conformément à la
        réglementation guinéenne relative aux transactions électroniques. Une commission, dont le taux est fixé par
        Occaz, est prélevée sur le montant versé au chauffeur.
      </Article>

      <Article title="5. Annulation et remboursement">
        Les conditions d'annulation et de remboursement applicables à chaque type de prestation sont précisées dans
        l'application au moment de la réservation ou de l'envoi.
      </Article>

      <Article title="6. Obligations des utilisateurs">
        Chaque utilisateur s'engage à se comporter de manière loyale et respectueuse, à ne transmettre aucune
        information fausse ou trompeuse, et à respecter les codes de validation propres à chaque étape d'une
        prestation. Tout comportement frauduleux peut entraîner la suspension du compte.
      </Article>

      <Article title="7. Responsabilité">
        Occaz met en œuvre des moyens raisonnables pour assurer la fiabilité de la plateforme, sans garantir
        l'absence d'interruption ou d'erreur. La responsabilité de la société ne saurait être engagée au titre du
        déroulement du trajet ou de la livraison, qui relève de la relation directe entre le chauffeur et le client.
      </Article>

      <Article title="8. Propriété intellectuelle">
        L'application, sa marque et son contenu sont la propriété d'Occaz ou de ses partenaires. Toute reproduction
        non autorisée est interdite.
      </Article>

      <Article title="9. Droit applicable et litiges">
        Les présentes conditions sont soumises au droit guinéen, y compris aux Actes uniformes de l'Organisation
        pour l'Harmonisation en Afrique du Droit des Affaires (OHADA) applicables en matière commerciale. Tout
        litige non résolu à l'amiable via le service client relève des juridictions compétentes de la République de
        Guinée.
      </Article>

      <Article title="10. Modification des conditions">
        Occaz peut modifier les présentes conditions à tout moment ; toute modification substantielle sera notifiée
        dans l'application avant son entrée en vigueur.
      </Article>

      <Article title="11. Contact">
        Pour toute question relative aux présentes conditions : Doniko.digital@gmail.com
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