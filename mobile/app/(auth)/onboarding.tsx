// mobile/app/(auth)/onboarding.tsx
// [30/10/2026] v+ — « Se connecter avec l'empreinte » au-dessus des cartes de rôle quand l'empreinte est active.
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [29/10/2026] v8 — Sélecteur de langue compact en haut à droite de la page (il quitte la page de connexion par numéro et le haut de la carte).
// [18/10/2026] v7 — Habillage « cadre blanc » : le logo reste au-dessus, et tout le contenu (Bienvenue, phrase, cartes de rôle,
// « Créer votre compte », « Suivre un colis ») est posé dans une grande carte blanche aux coins arrondis avec ombre douce.
// Design uniquement : textes, boutons et logique inchangés. La carte « Je suis conducteur » reçoit un contour bleu clair et une
// ombre légère pour rester lisible sur le blanc (la feuille « Créer votre compte » garde son style d'origine). La page défile
// si l'écran est trop court pour afficher la carte en entier.
// [11/10/2026] v6 — Correctifs d'affichage (vus sur le web à 353 px de large) :
//   - le ciel de fond gardait la taille de l'image (827 × 778) au lieu de remplir l'écran : il débordait à droite et s'arrêtait avant le
//     bas. Il est maintenant une image posée en absolu sur toute la page (View + Image), identique sur mobile et sur le web ;
//   - la feuille « Créer votre compte » est une carte centrée sur l'écran (et non plus collée en bas), quelle que soit la largeur.
// [11/10/2026] v5 — Les cartes de rôle ouvrent la connexion (numéro + mot de passe) ; la feuille « Créer votre compte » ouvre l'inscription
// en étapes (signup). Plus de paramètre `mode`.
// [10/10/2026] v4 — lien « Suivre un colis » (numéro de suivi, sans compte) sous « Créer votre compte ».
// [22/09/2026] v2 — Habillage bleu Ocean, dans l'esprit Tiime : icône posée
// sur un aplat doux à étincelles (AuthIllustration) au lieu du carré plein
// indigo, cartes de rôle arrondies avec ombre douce, typographie plus
// généreuse. Logique inchangée.
// [02/10/2026] v3 — « Conducteur » devient « Conducteur » sur tout l'écran.
// Le lien du bas « Déjà inscrit ? Se connecter » faisait exactement la même
// chose que les deux cartes de rôle : il est remplacé par « Pas encore client
// ou conducteur ? Créer votre compte », qui ouvre une modale pour choisir son
// type de compte. Les deux cartes du haut restent là pour que les personnes
// déjà inscrites se connectent immédiatement.
// Les cartes ouvrent la connexion ; la modale ouvre l'inscription en étapes.
import React, { useState } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconArrowRight, IconPackage, IconSteeringWheel, IconUser, IconX } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { LanguageSelector } from '@/components/auth/LanguageSelector';
import { BiometricLoginButton } from '@/components/auth/BiometricLoginButton';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import type { AccountType } from '@/types/auth.types';
import { useT } from '@/i18n';

const SKY_BACKGROUND = require('../../assets/images/onboarding-sky.jpg');
const LOGO_SOURCE = require('../../assets/images/pin-glyph.png');

interface RoleOptionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBackground: string;
  tone: 'ocean' | 'surface';
  onPress: () => void;
  /** Posée sur la carte blanche : la variante claire gagne un contour bleu clair et une ombre légère. */
  onCard?: boolean;
}

function RoleOption({ title, subtitle, icon, iconBackground, tone, onPress, onCard = false }: RoleOptionProps) {
  const isOcean = tone === 'ocean';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        isOcean ? styles.optionOcean : styles.optionSurface,
        !isOcean && onCard ? styles.optionSurfaceOnCard : null,
        { opacity: pressed ? 0.92 : 1 },
      ]}
    >
      <View style={[styles.optionIcon, { backgroundColor: iconBackground }]}>{icon}</View>
      <View style={styles.optionText}>
        <AppText variant="md" weight="semibold" color={isOcean ? OCEAN.onDark : 'textPrimary'}>
          {title}
        </AppText>
        <AppText variant="sm" color={isOcean ? OCEAN.sky : 'textSecondary'}>
          {subtitle}
        </AppText>
      </View>
      <IconArrowRight size={18} color={isOcean ? OCEAN.onDark : colors.textPrimary} />
    </Pressable>
  );
}

interface SignupSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (accountType: Extract<AccountType, 'CUSTOMER' | 'DRIVER'>) => void;
}

// Modale « Créer votre compte » : même enveloppe que ConfirmDialog (feuille en
// bas sur mobile, centrée dès le seuil tablette). Un appui sur le fond assombri
// ou sur la croix referme la feuille.
function SignupSheet({ visible, onClose, onSelect }: SignupSheetProps) {
  const t = useT();
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('Fermer')}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <AppText variant="xl" weight="bold" color={OCEAN.deep}>
                {t('Créer votre compte')}
              </AppText>
              <AppText variant="sm" color="textSecondary" style={styles.sheetSubtitle}>
                {t('Vous êtes plutôt…')}
              </AppText>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('Fermer')}
              style={styles.closeButton}
            >
              <IconX size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.options}>
            <RoleOption
              title={t('Client')}
              subtitle={t('Réserver un trajet ou un envoi')}
              icon={<IconUser size={19} color={OCEAN.onDark} />}
              iconBackground="rgba(255,255,255,0.16)"
              tone="ocean"
              onPress={() => onSelect('CUSTOMER')}
            />
            <RoleOption
              title={t('Conducteur')}
              subtitle={t('Rentabiliser mes trajets')}
              icon={<IconSteeringWheel size={19} color={colors.successDark} />}
              iconBackground={colors.successLight}
              tone="surface"
              onPress={() => onSelect('DRIVER')}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function OnboardingScreen() {
  const t = useT();
  const insets = useSafeAreaInsets();
  const [signupOpen, setSignupOpen] = useState(false);

  function goToLogin(accountType: AccountType) {
    router.push({ pathname: '/(auth)/login', params: { accountType } });
  }

  function selectSignupRole(accountType: Extract<AccountType, 'CUSTOMER' | 'DRIVER'>) {
    setSignupOpen(false);
    router.push({ pathname: '/(auth)/signup', params: { accountType } });
  }

  return (
    <View style={styles.background}>
      <Image source={SKY_BACKGROUND} resizeMode="cover" style={styles.sky} />
      <View style={styles.scrim} />
      <ScreenContainer transparent scroll style={styles.container} maxWidth="form">
        <View style={styles.hero}>
          <AuthIllustration icon={<Image source={LOGO_SOURCE} resizeMode="contain" style={styles.logo} />} />
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center">
              {t('Bienvenue')}
            </AppText>
            <AppText variant="base" color="textSecondary" align="center" style={styles.tagline}>
              {t('Trajets partagés et envois de colis,\npartout où vous allez.')}
            </AppText>
          </View>

          <BiometricLoginButton autoPrompt />

          <View style={styles.options}>
            <RoleOption
              title={t('Je suis client')}
              subtitle={t('Réserver un trajet ou un envoi')}
              icon={<IconUser size={19} color={OCEAN.onDark} />}
              iconBackground="rgba(255,255,255,0.16)"
              tone="ocean"
              onPress={() => goToLogin('CUSTOMER')}
              onCard
            />
            <RoleOption
              title={t('Je suis conducteur')}
              subtitle={t('Rentabiliser mes trajets')}
              icon={<IconSteeringWheel size={19} color={colors.successDark} />}
              iconBackground={colors.successLight}
              tone="surface"
              onPress={() => goToLogin('DRIVER')}
              onCard
            />
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Créer votre compte')}
            onPress={() => setSignupOpen(true)}
            style={styles.signupLink}
          >
            <AppText variant="sm" color="textSecondary" align="center">
              {t('Pas encore client ou conducteur ?\n')}
              <AppText variant="sm" weight="semibold" color={OCEAN.base}>
                {t('Créer votre compte')}
              </AppText>
            </AppText>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('Suivre un colis')}
            onPress={() => router.push('/suivi' as never)}
            style={styles.trackLink}
          >
            <IconPackage size={16} color={OCEAN.base} />
            <AppText variant="sm" weight="semibold" color={OCEAN.base}>
              {t('Suivre un colis')}
            </AppText>
          </Pressable>
        </View>
      </ScreenContainer>

      <View style={[styles.languageCorner, { top: insets.top + spacing.sm }]}>
        <LanguageSelector compact />
      </View>

      <SignupSheet visible={signupOpen} onClose={() => setSignupOpen(false)} onSelect={selectSignupRole} />
    </View>
  );
}

const styles = StyleSheet.create({
  languageCorner: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 10,
  },
  trackLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Le ciel remplit toute la page, quelle que soit la taille de l'image d'origine.
  sky: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
  },
  // Voile clair semi-transparent entre la photo et le contenu : le ciel
  // reste visible en fond mais le texte (sans carte derrière) garde un
  // contraste suffisant quel que soit l'endroit où tombent nuages/oiseau.
  scrim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  logo: {
    width: 32,
    height: 41,
  },
  // Page défilante : le contenu est centré à l'écran, et la carte reste
  // accessible en entier sur les petits téléphones.
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: spacing.lg,
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  // Grand cadre blanc qui porte tout le contenu de l'écran.
  card: {
    backgroundColor: colors.surface,
    borderRadius: 32,
    paddingTop: spacing.xl + 6,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.lg,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.16,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  cardHeader: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  tagline: {
    marginTop: spacing.xs,
  },
  options: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1.5,
  },
  optionOcean: {
    backgroundColor: OCEAN.deep,
    borderColor: OCEAN.deep,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  optionSurface: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  // Variante claire posée sur le cadre blanc : contour bleu clair + ombre douce.
  optionSurfaceOnCard: {
    borderColor: OCEAN.line,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  optionIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
  },
  signupLink: {
    marginTop: spacing.xl,
    paddingVertical: spacing.xs,
  },

  // --- Modale « Créer votre compte » ---------------------------------------
  // Carte centrée sur l'écran, avec une marge de chaque côté.
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  sheet: {
    width: '100%',
    maxWidth: maxContentWidth.form,
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sheetHeaderText: {
    flex: 1,
  },
  sheetSubtitle: {
    marginTop: spacing.xxs,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.lg,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
