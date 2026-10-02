// mobile/app/(auth)/onboarding.tsx
// [22/09/2026] v2 — Habillage bleu Ocean, dans l'esprit Tiime : icône posée
// sur un aplat doux à étincelles (AuthIllustration) au lieu du carré plein
// indigo, cartes de rôle arrondies avec ombre douce, typographie plus
// généreuse. Logique inchangée.
// [02/10/2026] v3 — « Chauffeur » devient « Conducteur » sur tout l'écran.
// Le lien du bas « Déjà inscrit ? Se connecter » faisait exactement la même
// chose que les deux cartes de rôle : il est remplacé par « Pas encore client
// ou conducteur ? Créer votre compte », qui ouvre une modale pour choisir son
// type de compte. Les deux cartes du haut restent là pour que les personnes
// déjà inscrites se connectent immédiatement.
// Les cartes ouvrent l'écran téléphone en mode « login » (un numéro inconnu
// est refusé), la modale l'ouvre en mode « signup » (le compte est créé).
import React, { useState } from 'react';
import { Image, ImageBackground, Modal, Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconArrowRight, IconSteeringWheel, IconUser, IconX } from '@tabler/icons-react-native';
import { AppText, ScreenContainer } from '@/components/ui';
import { AuthIllustration } from '@/components/illustrations/AuthIllustration';
import { useResponsive } from '@/hooks/useResponsive';
import { colors, maxContentWidth, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import type { AccountType } from '@/types/auth.types';

const SKY_BACKGROUND = require('../../assets/images/onboarding-sky.jpg');
const LOGO_SOURCE = require('../../assets/images/pin-glyph.png');

interface RoleOptionProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  iconBackground: string;
  tone: 'ocean' | 'surface';
  onPress: () => void;
}

function RoleOption({ title, subtitle, icon, iconBackground, tone, onPress }: RoleOptionProps) {
  const isOcean = tone === 'ocean';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [
        styles.option,
        isOcean ? styles.optionOcean : styles.optionSurface,
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
  const { isTablet } = useResponsive();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={[styles.overlay, isTablet && styles.overlayCentered]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Fermer"
        />
        <View style={[styles.sheet, isTablet && styles.sheetCentered]}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderText}>
              <AppText variant="xl" weight="bold" color={OCEAN.deep}>
                Créer votre compte
              </AppText>
              <AppText variant="sm" color="textSecondary" style={styles.sheetSubtitle}>
                Vous êtes plutôt…
              </AppText>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              style={styles.closeButton}
            >
              <IconX size={18} color={colors.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.options}>
            <RoleOption
              title="Client"
              subtitle="Réserver un trajet ou un envoi"
              icon={<IconUser size={19} color={OCEAN.onDark} />}
              iconBackground="rgba(255,255,255,0.16)"
              tone="ocean"
              onPress={() => onSelect('CUSTOMER')}
            />
            <RoleOption
              title="Conducteur"
              subtitle="Rentabiliser mes trajets"
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
  const [signupOpen, setSignupOpen] = useState(false);

  function goToPhoneScreen(accountType: AccountType, mode: 'login' | 'signup') {
    router.push({ pathname: '/(auth)/login', params: { accountType, mode } });
  }

  function selectSignupRole(accountType: Extract<AccountType, 'CUSTOMER' | 'DRIVER'>) {
    setSignupOpen(false);
    goToPhoneScreen(accountType, 'signup');
  }

  return (
    <ImageBackground source={SKY_BACKGROUND} resizeMode="cover" style={styles.background}>
      <View style={styles.scrim} />
      <ScreenContainer transparent style={styles.container} maxWidth="form">
        <View style={styles.hero}>
          <AuthIllustration icon={<Image source={LOGO_SOURCE} resizeMode="contain" style={styles.logo} />} />
          <AppText variant="xxl" weight="bold" color={OCEAN.deep} align="center" style={styles.title}>
            Bienvenue
          </AppText>
          <AppText variant="base" color="textSecondary" align="center" style={styles.tagline}>
            Trajets partagés et envois de colis,{'\n'}partout où vous allez.
          </AppText>
        </View>

        <View style={styles.options}>
          <RoleOption
            title="Je suis client"
            subtitle="Réserver un trajet ou un envoi"
            icon={<IconUser size={19} color={OCEAN.onDark} />}
            iconBackground="rgba(255,255,255,0.16)"
            tone="ocean"
            onPress={() => goToPhoneScreen('CUSTOMER', 'login')}
          />
          <RoleOption
            title="Je suis conducteur"
            subtitle="Rentabiliser mes trajets"
            icon={<IconSteeringWheel size={19} color={colors.successDark} />}
            iconBackground={colors.successLight}
            tone="surface"
            onPress={() => goToPhoneScreen('DRIVER', 'login')}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Créer votre compte"
          onPress={() => setSignupOpen(true)}
          style={styles.signupLink}
        >
          <AppText variant="sm" color="textSecondary" align="center">
            Pas encore client ou conducteur ?{'\n'}
            <AppText variant="sm" weight="semibold" color={OCEAN.base}>
              Créer votre compte
            </AppText>
          </AppText>
        </Pressable>
      </ScreenContainer>

      <SignupSheet visible={signupOpen} onClose={() => setSignupOpen(false)} onSelect={selectSignupRole} />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
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
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  hero: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    marginTop: spacing.lg,
  },
  tagline: {
    marginTop: spacing.xxs,
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
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  overlayCentered: {
    justifyContent: 'center',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.lg,
    shadowColor: OCEAN.deep,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -6 },
    elevation: 12,
  },
  sheetCentered: {
    maxWidth: maxContentWidth.form,
    width: '100%',
    alignSelf: 'center',
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
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