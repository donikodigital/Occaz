// mobile/src/components/screens/EmergencyContactsScreen.tsx
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
import { useAddEmergencyContact, useEmergencyContacts, useRemoveEmergencyContact } from '@/hooks/useSafety';
import { isValidPhoneNumber, normalizePhoneInput } from '@/utils/phone';
import type { EmergencyContact } from '@/types/safety.types';

const MAX_CONTACTS = 3;

export function EmergencyContactsScreen() {
  const { data, isLoading } = useEmergencyContacts();
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
      setFieldError('Indiquez le nom de votre proche.');
      return;
    }
    if (!isValidPhoneNumber(phone)) {
      setFieldError('Numéro invalide : écrivez-le au format international, par exemple +224620000000.');
      return;
    }
    add.mutate(
      { name: name.trim(), phone: phone.trim() },
      {
        onSuccess: () => {
          setName('');
          setPhone('+224');
          setFeedback({ tone: 'success', text: 'Proche ajouté. Il sera prévenu par SMS si vous envoyez une alerte.' });
        },
        onError: (error) => setFeedback({ tone: 'error', text: error instanceof ApiError ? error.message : 'Impossible d’ajouter ce proche.' }),
      },
    );
  }

  function confirmRemove() {
    if (!toRemove) return;
    remove.mutate(toRemove.id, {
      onSuccess: () => setToRemove(null),
      onError: (error) => {
        setToRemove(null);
        setFeedback({ tone: 'error', text: error instanceof ApiError ? error.message : 'Impossible de retirer ce proche.' });
      },
    });
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader title="Mes proches" subtitle="Prévenus par SMS si vous envoyez un SOS" icon={<IconUsersGroup />} onBack={() => router.back()} />

      {feedback ? (
        <View style={styles.banner}>
          <FeedbackBanner tone={feedback.tone} text={feedback.text} onDismiss={() => setFeedback(null)} />
        </View>
      ) : null}

      {contacts.length === 0 && !isLoading ? (
        <OceanEmpty
          icon={<IconUsersGroup size={26} color={OCEAN.base} />}
          title="Aucun proche enregistré"
          text="Ajoutez jusqu’à 3 personnes de confiance. En cas d’alerte, elles reçoivent un SMS avec votre position."
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
              <OceanButton label="Retirer" variant="danger" icon={<IconTrash size={16} color={colors.danger} />} onPress={() => setToRemove(contact)} style={styles.removeButton} />
            </OceanCard>
          ))}
        </View>
      )}

      {isFull ? (
        <AppText variant="xs" color="textMuted" align="center" style={styles.full}>
          Vous avez atteint les {MAX_CONTACTS} proches. Retirez-en un pour en ajouter un autre.
        </AppText>
      ) : (
        <OceanSection icon={<IconUserPlus size={17} color={OCEAN.base} />} title="Ajouter un proche" style={styles.section}>
          <TextField label="Nom" value={name} onChangeText={setName} placeholder="Mariama (sœur)" maxLength={60} />
          <TextField
            label="Téléphone"
            value={phone}
            onChangeText={(text) => setPhone(normalizePhoneInput(text))}
            placeholder="+224620000000"
            keyboardType="phone-pad"
            error={fieldError}
          />
          <OceanButton label="Ajouter" onPress={handleAdd} loading={add.isPending} />
        </OceanSection>
      )}

      <ConfirmDialog
        visible={toRemove !== null}
        title="Retirer ce proche ?"
        message={toRemove ? `${toRemove.name} ne sera plus prévenu en cas d’alerte.` : undefined}
        confirmLabel="Retirer"
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
