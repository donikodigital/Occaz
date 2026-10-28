// mobile/src/components/screens/EmergencyContactsScreen.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [19/10/2026] v+ — les textes suivent le réglage serveur (features.sosSms) : plus de promesse de SMS quand ils sont coupés.
// [11/10/2026] v1 — « Mes proches » : les personnes (3 au plus) prévenues par SMS, avec votre position, quand vous envoyez une alerte SOS.
// Partagé entre l'espace client et l'espace conducteur. Erreurs et confirmations dans la page (jamais Alert.alert).
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconPhone, IconTrash, IconUserPlus, IconUsersGroup } from '@tabler/icons-react-native';
import { AppText, ConfirmDialog, FeedbackBanner, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanSection } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { ApiError } from '@/services/api/ApiError';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useAddEmergencyContact, useEmergencyContacts, useRemoveEmergencyContact } from '@/hooks/useSafety';
import { isValidPhoneNumber, normalizePhoneInput } from '@/utils/phone';
import type { EmergencyContact } from '@/types/safety.types';
import { useT } from '@/i18n';

const MAX_CONTACTS = 3;

export function EmergencyContactsScreen() {
  const t = useT();
  const { data, isLoading } = useEmergencyContacts();
  // Les SMS d'alerte aux proches sont coupés par défaut (coût) : sans confirmation du serveur, on ne promet pas de SMS.
  const { data: appConfig } = useAppConfig();
  const sosSms = appConfig?.features.sosSms === true;
  const add = useAddEmergencyContact();
  const remove = useRemoveEmergencyContact();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+224');
  const [toRemove, setToRemove] = useState<EmergencyContact | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();

  const contacts = data ?? [];
  const isFull = contacts.length >= MAX_CONTACTS;

  function handleAdd() {
    setFeedback(null);
    setFieldError(undefined);
    if (name.trim().length < 2) {
      setFieldError(t('Indiquez le nom de votre proche.'));
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setFieldError(t('Numéro invalide : écrivez-le au format international, par exemple +224620000000.'));
      return;
    }
    add.mutate(
      { name: name.trim(), phone: phone.trim() },
      {
        onSuccess: () => {
          setName('');
          setPhone('+224');
          setFeedback({ tone: 'success', text: sosSms ? t('Proche ajouté. Il sera prévenu par SMS si vous envoyez une alerte.') : t('Proche ajouté. Ses coordonnées sont enregistrées ; l’envoi de SMS d’alerte aux proches n’est pas actif pour le moment.') });
        },
        onError: (error) => setFeedback({ tone: 'error', text: error instanceof ApiError ? error.message : t('Impossible d’ajouter ce proche.') }),
      },
    );
  }

  function confirmRemove() {
    if (!toRemove) return;
    remove.mutate(toRemove.id, {
      onSuccess: () => setToRemove(null),
      onError: (error) => {
        setToRemove(null);
        setFeedback({ tone: 'error', text: error instanceof ApiError ? error.message : t('Impossible de retirer ce proche.') });
      },
    });
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title={t('Mes proches')} subtitle={sosSms ? t('Prévenus par SMS si vous envoyez un SOS') : t('Vos personnes de confiance')} icon={<IconUsersGroup />} onBack={() => router.back()} />

      {feedback ? (
        <View style={styles.banner}>
          <FeedbackBanner tone={feedback.tone} text={feedback.text} onDismiss={() => setFeedback(null)} />
        </View>
      ) : null}

      {contacts.length === 0 && !isLoading ? (
        <OceanEmpty
          icon={<IconUsersGroup size={26} color={OCEAN.base} />}
          title={t('Aucun proche enregistré')}
          text={sosSms ? t('Ajoutez jusqu’à 3 personnes de confiance. En cas d’alerte, elles reçoivent un SMS avec votre position.') : t('Ajoutez jusqu’à 3 personnes de confiance. L’envoi de SMS d’alerte à vos proches n’est pas actif pour le moment : en cas d’alerte, l’équipe Occa’Z est prévenue.')}
        />
      ) : (
        <View style={styles.list}>
          {contacts.map((contact) => (
            <OceanCard key={contact.id} style={styles.contact}>
              <View style={styles.contactTile}>
                <IconPhone size={18} color={OCEAN.base} />
              </View>
              <View style={styles.contactText}>
                <AppText variant="base" weight="semibold" numberOfLines={1}>
                  {contact.name}
                </AppText>
                <AppText variant="xs" color="textSecondary">
                  {contact.phone}
                </AppText>
              </View>
              <OceanButton label={t('Retirer')} variant="danger" icon={<IconTrash size={16} color={colors.danger} />} onPress={() => setToRemove(contact)} style={styles.removeButton} />
            </OceanCard>
          ))}
        </View>
      )}

      {isFull ? (
        <AppText variant="xs" color="textMuted" align="center" style={styles.full}>
          {t('Vous avez atteint les {MAX_CONTACTS} proches. Retirez-en un pour en ajouter un autre.', { MAX_CONTACTS })}
        </AppText>
      ) : (
        <OceanSection icon={<IconUserPlus size={17} color={OCEAN.base} />} title={t('Ajouter un proche')} style={styles.section}>
          <TextField label={t('Nom')} value={name} onChangeText={setName} placeholder={t('Mariama (sœur)')} maxLength={60} />
          <TextField
            label={t('Téléphone')}
            value={phone}
            onChangeText={(text) => setPhone(normalizePhoneInput(text))}
            placeholder="+224620000000"
            keyboardType="phone-pad"
            error={fieldError}
          />
          <OceanButton label={t('Ajouter')} onPress={handleAdd} loading={add.isPending} />
        </OceanSection>
      )}

      <ConfirmDialog
        visible={toRemove !== null}
        title={t('Retirer ce proche ?')}
        message={toRemove ? t('{toRemoveName} ne sera plus prévenu en cas d’alerte.', { toRemoveName: toRemove.name }) : undefined}
        confirmLabel={t('Retirer')}
        destructive
        loading={remove.isPending}
        onConfirm={confirmRemove}
        onCancel={() => setToRemove(null)}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  banner: { marginBottom: spacing.md },
  list: { gap: spacing.sm, marginBottom: spacing.md },
  contact: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  contactTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactText: { flex: 1, gap: 1 },
  removeButton: { paddingHorizontal: spacing.sm, minHeight: 40 },
  section: { marginBottom: spacing.lg },
  full: { marginBottom: spacing.lg },
});
