// mobile/app/(driver)/payout-new.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
//
// [25/10/2026] v6 — Nouveau numéro : le retrait n'attend plus l'équipe. Il est programmé (délai de sécurité d'une heure par défaut), l'écran dit à
// quelle heure il partira, et le conducteur peut l'annuler d'ici là (« Annuler ce retrait ») : les fonds sont remis dans son solde.
//
// [19/10/2026] v5 — Le retrait est confirmé par le CODE PIN de connexion (6 chiffres), à la place d'un SMS : six cases masquées sous les champs.
// Un PIN faux est expliqué sur place (le serveur verrouille le compte 15 min après 5 erreurs, comme à la connexion). Un NOUVEAU numéro est
// vérifié par l'équipe avant le premier envoi : l'écran de résultat le dit.
//
// [10/10/2026] v4 — Habillage Ocean, comme les autres pages : bandeau (héro) en tête, solde dans une carte ombrée, champs dans une section
// à en-tête souligné, bouton Ocean, message d'erreur en bandeau dans la page. Logique et écran de résultat inchangés.
//
// [07/10/2026] v3 — Retrait en mode Manuel : l'écran annonce « En attente de validation » (statut de la demande, même libellé que
// dans l'historique du portefeuille) et dit que le montant est mis de côté en attendant la décision de l'équipe.
//
// [05/10/2026] v2 — Le retrait part tout de suite sur le compte Mobile Money (retrait automatique) ; l'écran dit ensuite ce qui s'est
// passé : effectué, en cours, demande en attente de validation (réglage de l'équipe ou montant au-dessus du plafond), ou refusé
// (le montant est alors remis dans le solde). Plus de retour silencieux sans savoir où en est son argent.
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import {
  IconAlertTriangle,
  IconCash,
  IconCircleCheck,
  IconClockHour4,
  IconLock,
  IconSend,
  IconWallet,
} from '@tabler/icons-react-native';
import { AppText, FeedbackBanner, ScreenContainer, TextField } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { useMyWallet } from '@/hooks/useWallet';
import { useCancelPayout, useRequestPayout } from '@/hooks/usePayouts';
import { useDriverProfile } from '@/hooks/useDriverProfile';
import { formatMoney } from '@/utils/money';
import { formatTime } from '@/utils/date';
import { ApiError } from '@/services/api/ApiError';
import { PIN_LENGTH, PinCodeInput } from '@/components/auth/PinCodeInput';
import { OceanButton, OceanCard, OceanSection } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { OCEAN } from '@/theme/ocean';
import type { Payout } from '@/types/payouts.types';
import { useT, translate } from '@/i18n';

/** Ce que le conducteur doit comprendre une fois sa demande envoyée, selon l'état du retrait renvoyé par le serveur. */
function describeOutcome(payout: Payout, amountText: string, destination: string) {
  const masked = destination.replace(/\D/g, '').length >= 4 ? `••••${destination.replace(/\D/g, '').slice(-4)}` : translate('votre compte Mobile Money');
  switch (payout.status) {
    case 'PAID':
      return {
        Icon: IconCircleCheck,
        tint: colors.successDark,
        title: translate('Retrait effectué'),
        text: translate('{amountText} ont été envoyés sur votre compte Mobile Money ({masked}).', { amountText, masked }),
      };
    case 'CANCELLED':
      return {
        Icon: IconCircleCheck,
        tint: OCEAN.base,
        title: translate('Retrait annulé'),
        text: translate("Rien n'a été envoyé : {amountText} ont été remis dans votre solde disponible.", { amountText }),
      };
    case 'FAILED':
      return {
        Icon: IconAlertTriangle,
        tint: colors.danger,
        title: translate('Retrait refusé'),
        text: translate('{value}Le montant a été remis dans votre solde : vous pouvez réessayer avec un autre numéro.', { value: payout.failureReason ? `${payout.failureReason} ` : '' }),
      };
    case 'PROCESSING':
      return {
        Icon: IconSend,
        tint: OCEAN.base,
        title: translate('Retrait en cours'),
        text: translate("{amountText} sont en cours d'envoi vers {masked}. Vous serez prévenu dès que ce sera arrivé.", { amountText, masked }),
      };
    default:
      if (payout.autoReleaseAt) {
        return {
          Icon: IconClockHour4,
          tint: OCEAN.base,
          title: translate('Retrait programmé'),
          text: translate("Par sécurité, {amountText} partiront automatiquement vers {masked} à {time} (nouveau numéro). Le montant est mis de côté. Ce n'est pas vous ? Annulez-le avant cette heure.", { amountText, masked, time: formatTime(payout.autoReleaseAt) }),
        };
      }
      return {
        Icon: IconClockHour4,
        tint: OCEAN.base,
        title: translate('En attente de validation'),
        text: translate("Votre retrait de {amountText} a bien été demandé : il doit être validé par l'équipe avant l'envoi vers {masked} (un nouveau numéro est toujours vérifié la première fois). Le montant est mis de côté, et vous serez prévenu dès que ce sera traité.", { amountText, masked }),
      };
  }
}

export default function NewPayoutScreen() {
  const t = useT();
  const { data: wallet } = useMyWallet();
  const { data: profile } = useDriverProfile();
  const [amount, setAmount] = useState('');
  const [destinationRef, setDestinationRef] = useState(profile?.mobileMoneyNumber ?? '');
  const [pin, setPin] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [result, setResult] = useState<{ payout: Payout; amountText: string; destination: string } | null>(null);
  const requestPayout = useRequestPayout();
  const cancelPayout = useCancelPayout();

  function handleSubmit() {
    setErrorMessage(undefined);
    const numericAmount = Number(amount.replace(',', '.'));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setErrorMessage(t('Indiquez un montant valide.'));
      return;
    }
    if (wallet && numericAmount > Number(wallet.balance)) {
      setErrorMessage(t('Le montant dépasse votre solde disponible.'));
      return;
    }
    if (!destinationRef.trim()) {
      setErrorMessage(t('Indiquez le numéro Mobile Money de destination.'));
      return;
    }

    if (pin.length !== PIN_LENGTH) {
      setErrorMessage(t('Saisissez votre code PIN de connexion (6 chiffres) pour confirmer le retrait.'));
      return;
    }

    requestPayout.mutate(
      {
        amount: String(Math.round(numericAmount)),
        method: 'mobile_money',
        destinationRef: destinationRef.trim(),
        pin,
      },
      {
        onSuccess: (payout) =>
          setResult({
            payout,
            amountText: formatMoney(Math.round(numericAmount), wallet?.currency?.isoCode),
            destination: destinationRef.trim(),
          }),
        onError: (error) => {
          // Quel que soit l'échec, on efface le PIN : il faut le ressaisir (et rien ne reste affiché à l'écran).
          setPin('');
          setErrorMessage(error instanceof ApiError ? error.message : t('Une erreur est survenue.'));
        },
      },
    );
  }

  // Résultat du retrait : dit où en est l'argent, puis retour au portefeuille.
  if (result) {
    const outcome = describeOutcome(result.payout, result.amountText, result.destination);
    return (
      <ScreenContainer maxWidth="form">
        <View style={styles.resultBody}>
          <View style={[styles.resultIcon, { backgroundColor: `${outcome.tint}1A` }]}>
            <outcome.Icon size={40} color={outcome.tint} />
          </View>
          <AppText variant="xxl" weight="bold" align="center" color={OCEAN.deep}>
            {outcome.title}
          </AppText>
          <AppText variant="base" color="textSecondary" align="center">
            {outcome.text}
          </AppText>
        </View>
        {errorMessage ? <FeedbackBanner tone="error" title={t('Annulation impossible')} text={errorMessage} onDismiss={() => setErrorMessage(undefined)} /> : null}
        {result.payout.status === 'REQUESTED' ? (
          <OceanButton
            label={t('Annuler ce retrait')}
            variant="danger"
            loading={cancelPayout.isPending}
            onPress={() => {
              setErrorMessage(undefined);
              cancelPayout.mutate(result.payout.id, {
                onSuccess: (payout) => setResult({ ...result, payout }),
                onError: (error) => setErrorMessage(error instanceof ApiError ? error.message : t('Réessayez dans un instant.')),
              });
            }}
            style={styles.submit}
          />
        ) : null}
        <OceanButton label={t('Terminé')} onPress={() => router.back()} style={styles.submit} />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer scroll maxWidth="form">
      <OceanHeroHeader
        title={t('Retirer des fonds')}
        subtitle={t('Envoyez votre solde sur votre Mobile Money')}
        icon={<IconCash />}
        onBack={() => router.back()}
      />

      <OceanCard style={styles.balanceCard}>
        <View style={styles.balanceTile}>
          <IconWallet size={20} color={OCEAN.base} />
        </View>
        <View style={styles.balanceText}>
          <AppText variant="xs" color="textSecondary">
            {t('Solde disponible')}
          </AppText>
          <AppText variant="xl" weight="bold" color={OCEAN.deep}>
            {wallet ? formatMoney(wallet.balance, wallet.currency?.isoCode) : '…'}
          </AppText>
        </View>
      </OceanCard>

      <OceanSection icon={<IconSend size={17} color={OCEAN.base} />} title={t('Votre retrait')}>
        <TextField
          label={t('Montant à retirer')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
          placeholder={t('Ex : 100000')}
        />
        <TextField
          label={t('Numéro Mobile Money')}
          value={destinationRef}
          onChangeText={setDestinationRef}
          keyboardType="phone-pad"
          placeholder="+224620000000"
        />
      </OceanSection>

      <OceanSection icon={<IconLock size={17} color={OCEAN.base} />} title={t('Confirmez avec votre code PIN')}>
        <PinCodeInput
          label={t('Code PIN de connexion')}
          value={pin}
          onChange={(next) => {
            setPin(next);
            if (errorMessage) setErrorMessage(undefined);
          }}
          autoFocus={false}
          hasError={Boolean(errorMessage) && pin.length === 0}
        />
      </OceanSection>

      {errorMessage ? (
        <View style={styles.error}>
          <FeedbackBanner text={errorMessage} onDismiss={() => setErrorMessage(undefined)} />
        </View>
      ) : null}

      <OceanButton
        label={t('Confirmer le retrait')}
        onPress={handleSubmit}
        loading={requestPayout.isPending}
        style={styles.submit}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  balanceTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OCEAN.mist,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceText: {
    flex: 1,
    gap: 1,
  },
  error: {
    marginBottom: spacing.md,
  },
  submit: {
    marginBottom: spacing.md,
  },
  resultBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
  },
  resultIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
});