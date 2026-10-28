// mobile/app/(customer)/referral.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
//
// [07/10/2026] v1.1 — Le message de partage contient le lien d'invitation (page /rejoindre du site) et le code : voir
// utils/referralShare.ts.
//
// v1 — Parrainage : votre code (à partager), un champ pour saisir celui
// d'un ami, et la liste de vos filleuls avec leur statut. La récompense
// n'est pas encore créditée automatiquement (voir ReferralsService,
// backend) — le statut affiché ici reste correct, seul son passage à
// « validé » se fait aujourd'hui côté admin.

import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { IconCopy, IconGift, IconShare } from '@tabler/icons-react-native';
import { AppText, ResponsiveList, ScreenContainer, TextField } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanPill, OceanScreenHeader, type OceanPillTone } from '@/components/ocean/OceanKit';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useApplyReferralCode, useMyReferralCode, useMyReferrals } from '@/hooks/usePromotions';
import { formatDateShort } from '@/utils/date';
import { buildReferralShareMessage } from '@/utils/referralShare';
import { ApiError } from '@/services/api/ApiError';
import type { Referral, ReferralStatus } from '@/types/promotions.types';
import { useT, translate } from '@/i18n';

const STATUS_LABELS: Record<ReferralStatus, string> = {
  get PENDING() { return translate('En attente'); },
  get COMPLETED() { return translate('Validé'); },
  get EXPIRED() { return translate('Expiré'); },
};

const STATUS_TONES: Record<ReferralStatus, OceanPillTone> = {
  PENDING: 'gold',
  COMPLETED: 'success',
  EXPIRED: 'neutral',
};

function nameOf(referral: Referral): string {
  const profile = referral.referee.driverProfile ?? referral.referee.customerProfile;
  return profile ? `${profile.firstName} ${profile.lastName}` : translate('Utilisateur');
}

function ReferralRow({ referral }: { referral: Referral }) {
  const t = useT();
  return (
    <OceanCard style={styles.row}>
      <View style={{ flex: 1 }}>
        <AppText variant="sm" weight="semibold">
          {nameOf(referral)}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {t('Inscrit le {dateShort}', { dateShort: formatDateShort(referral.createdAt) })}
        </AppText>
      </View>
      <OceanPill label={STATUS_LABELS[referral.status]} tone={STATUS_TONES[referral.status]} />
    </OceanCard>
  );
}

export default function ReferralScreen() {
  const t = useT();
  const { data: myCode } = useMyReferralCode();
  const { data: referralsPage, isLoading } = useMyReferrals();
  const applyCode = useApplyReferralCode();
  const [enteredCode, setEnteredCode] = useState('');
  const [applyError, setApplyError] = useState<string | undefined>();
  const [applySuccess, setApplySuccess] = useState(false);

  async function handleShare() {
    if (!myCode) return;
    await Share.share({ message: buildReferralShareMessage(myCode.code) });
  }

  function handleApply() {
    setApplyError(undefined);
    setApplySuccess(false);
    if (!enteredCode.trim()) return;
    applyCode.mutate(enteredCode.trim().toUpperCase(), {
      onSuccess: () => {
        setApplySuccess(true);
        setEnteredCode('');
      },
      onError: (error) => setApplyError(error instanceof ApiError ? error.message : t("Le code n'a pas pu être appliqué.")),
    });
  }

  const referrals = referralsPage?.data ?? [];

  return (
    <ScreenContainer padded={false} maxWidth="detail">
      <View style={styles.headerWrap}>
        <OceanScreenHeader title={t('Parrainez des amis')} onBack={() => router.back()} />

        <View style={styles.codeCard}>
          <IconGift size={26} color={OCEAN.onDark} />
          <AppText variant="xs" color={OCEAN.sky} style={styles.codeLabel}>
            {t('Votre code de parrainage')}
          </AppText>
          <AppText variant="xxl" weight="bold" color={OCEAN.onDark} style={styles.codeValue}>
            {myCode?.code ?? '…'}
          </AppText>
          <OceanButton label={t('Partager mon code')} icon={<IconShare size={16} color={OCEAN.deep} />} variant="soft" onPress={handleShare} />
        </View>

        <View style={styles.applyBlock}>
          <AppText variant="sm" weight="semibold" style={{ marginBottom: spacing.xs }}>
            {t('Un code à saisir ?')}
          </AppText>
          <View style={styles.applyRow}>
            <TextField
              value={enteredCode}
              onChangeText={(t) => setEnteredCode(t.toUpperCase())}
              placeholder={t("Code d'un ami")}
              autoCapitalize="characters"
              containerStyle={styles.applyInput}
            />
            <OceanButton label={t('Valider')} onPress={handleApply} loading={applyCode.isPending} style={styles.applyButton} />
          </View>
          {applyError ? (
            <AppText variant="xs" color="danger">
              {applyError}
            </AppText>
          ) : null}
          {applySuccess ? (
            <AppText variant="xs" color={colors.successDark}>
              {t('Code appliqué avec succès.')}
            </AppText>
          ) : null}
        </View>

        <AppText variant="sm" weight="semibold" style={styles.listTitle}>
          {t('Vos filleuls')}
        </AppText>
      </View>

      <ResponsiveList
        data={referrals}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
        ListEmptyComponent={
          !isLoading ? (
            <OceanEmpty
              icon={<IconCopy size={26} color={OCEAN.base} />}
              title={t("Aucun filleul pour l'instant")}
              text={t('Partagez votre code pour commencer à parrainer.')}
            />
          ) : undefined
        }
        renderItem={({ item }) => <ReferralRow referral={item} />}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: spacing.lg,
  },
  codeCard: {
    alignItems: 'center',
    backgroundColor: OCEAN.deep,
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  codeLabel: {
    marginTop: spacing.xs,
  },
  codeValue: {
    letterSpacing: 2,
    marginVertical: spacing.xs,
  },
  applyBlock: {
    marginBottom: spacing.lg,
  },
  applyRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  applyInput: {
    flex: 1,
  },
  applyButton: {
    marginTop: 2,
  },
  listTitle: {
    marginBottom: spacing.sm,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  row: {
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});