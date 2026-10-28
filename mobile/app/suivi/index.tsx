// mobile/app/suivi/index.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
// [10/10/2026] v2 — padding ajouté à la carte de saisie (OceanCard n'a pas de padding de base : texte, champ et bouton touchaient le cadre).
// [10/10/2026] v1 — « Suivre un colis » : on saisit le numéro de suivi (étiquette du colis, e-mail) et on ouvre la page de suivi.
// Accessible sans compte, depuis l'accueil de bienvenue.
import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { IconPackage, IconSearch } from '@tabler/icons-react-native';
import { AppText, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanCard } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { parseTrackingNumber } from '@/utils/tracking';
import { useT } from '@/i18n';

export default function TrackParcelScreen() {
  const t = useT();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const trackingNumber = parseTrackingNumber(value);
    if (!trackingNumber) {
      setError(t('Ce numéro n’est pas valide. Il commence par OCZ, suivi de 10 caractères (ex. OCZ 7F3A 91C2 B0).'));
      return;
    }
    setError(null);
    router.push(`/suivi/${trackingNumber}` as never);
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader
        title={t('Suivre un colis')}
        subtitle={t('Sans compte, avec votre numéro de suivi')}
        icon={<IconPackage />}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <OceanCard style={styles.card}>
        <AppText variant="sm" color="textSecondary">
          {t('Saisissez le numéro de suivi écrit sur l’étiquette du colis ou dans l’e-mail reçu. Aucun compte n’est nécessaire.')}
        </AppText>
        <TextField
          label={t('Numéro de suivi')}
          placeholder={t('OCZ 7F3A 91C2 B0')}
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
        <OceanButton label={t('Suivre mon colis')} icon={<IconSearch size={16} color={OCEAN.onDark} />} onPress={submit} disabled={value.trim().length === 0} />
      </OceanCard>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md, padding: spacing.md },
});
