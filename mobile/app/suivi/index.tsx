// mobile/app/suivi/index.tsx
// [10/10/2026] v1 — « Suivre un colis » : on saisit le numéro de suivi (étiquette du colis, e-mail) et on ouvre la page de suivi.
// Accessible sans compte, depuis l'accueil de bienvenue.
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { IconSearch } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanCard, OceanScreenHeader } from '@/components/ocean/OceanKit';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { parseTrackingNumber } from '@/utils/tracking';

export default function TrackParcelScreen() {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trackingNumber = parseTrackingNumber(value);
    if (!trackingNumber) {
      setError('Ce numéro n’est pas valide. Il commence par OCZ, suivi de 10 caractères (ex. OCZ 7F3A 91C2 B0).');
      return;
    }
    setError(null);
    router.push(`/suivi/${trackingNumber}` as never);
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanScreenHeader
        title="Suivre un colis"
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <OceanCard style={styles.card}>
        <AppText variant="sm" color="textSecondary">
          Saisissez le numéro de suivi écrit sur l’étiquette du colis ou dans l’e-mail reçu. Aucun compte n’est nécessaire.
        </AppText>
        <TextField
          label="Numéro de suivi"
          placeholder="OCZ 7F3A 91C2 B0"
          value={value}
          onChangeText={(text) => {
            setValue(text);
            if (error) setError(null);
          }}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={submit}
          error={error ?? undefined}
        />
        <OceanButton label="Suivre mon colis" icon={<IconSearch size={16} color={OCEAN.onDark} />} onPress={submit} disabled={value.trim().length === 0} />
      </OceanCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
});
