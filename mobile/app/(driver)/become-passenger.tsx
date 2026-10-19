// mobile/app/(driver)/become-passenger.tsx
// [19/10/2026] v1 — « Utiliser Occa'Z comme passager » : un conducteur ouvre son espace passager avec le MÊME compte.
// Aucun nouveau SMS ni nouveau numéro : le code PIN de connexion confirme la demande. Son profil conducteur (nom, photo, ville) sert à créer
// le profil passager. Les deux portefeuilles restent séparés, et il ne peut pas réserver son propre trajet. Un dossier conducteur « en
// attente » n'empêche rien. Les erreurs (PIN faux, compte suspendu) s'affichent dans la page.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconLock, IconShieldCheck, IconUser, IconWallet } from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanScreenHeader, OceanSection } from '@/components/ocean/OceanKit';
import { PIN_LENGTH, PinCodeInput } from '@/components/auth/PinCodeInput';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useActivateCustomerSpace } from '@/hooks/useAccountRoles';
import { ApiError } from '@/services/api/ApiError';

const POINTS = [
  { icon: IconUser, text: 'Même numéro de téléphone, même code PIN : rien à recréer.' },
  { icon: IconWallet, text: 'Votre portefeuille conducteur reste séparé de vos paiements de passager.' },
  { icon: IconShieldCheck, text: 'Vous ne pouvez pas réserver ni envoyer un colis sur votre propre trajet.' },
];

export default function BecomePassengerScreen() {
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const activate = useActivateCustomerSpace();

  function handleSubmit(code = pin) {
    setErrorMessage(undefined);
    if (code.length !== PIN_LENGTH) {
      setErrorMessage('Saisissez votre code PIN de connexion (6 chiffres).');
      return;
    }
    activate.mutate(code, {
      onError: (error) => {
        // Quel que soit l'échec, le PIN est effacé : il faut le ressaisir.
        setPin('');
        setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.');
      },
    });
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader
        title="Utiliser Occa'Z comme passager"
        subtitle="Avec votre compte conducteur"
        onBack={() => router.back()}
      />

      <OceanSection icon={<IconUser size={17} color={OCEAN.base} />} title="Ce qui change">
        {POINTS.map(({ icon: Icon, text }) => (
          <View key={text} style={styles.point}>
            <View style={styles.pointIcon}>
              <Icon size={16} color={OCEAN.base} />
            </View>
            <AppText variant="sm" color="textSecondary" style={styles.pointText}>
              {text}
            </AppText>
          </View>
        ))}
      </OceanSection>

      <OceanSection icon={<IconLock size={17} color={OCEAN.base} />} title="Confirmez avec votre code PIN">
        <PinCodeInput
          label="Code PIN de connexion"
          value={pin}
          onChange={(next) => {
            setPin(next);
            setErrorMessage(undefined);
          }}
          onComplete={handleSubmit}
          hasError={Boolean(errorMessage) && pin.length === 0}
          autoFocus={false}
        />
      </OceanSection>

      {errorMessage ? (
        <View style={styles.feedback}>
          <FeedbackBanner tone="error" text={errorMessage} onDismiss={() => setErrorMessage(undefined)} />
        </View>
      ) : null}

      <OceanButton
        label="Ouvrir mon espace passager"
        onPress={() => handleSubmit()}
        loading={activate.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  point: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  pointIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointText: { flex: 1 },
  feedback: { marginBottom: spacing.sm },
  submit: { marginBottom: spacing.lg },
});
