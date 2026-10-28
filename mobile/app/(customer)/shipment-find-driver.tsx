// mobile/app/(customer)/shipment-find-driver.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] En-tête en bandeau (héro) bleu océan, comme les autres pages ; le reste de l'écran est inchangé.
//
// [10/10/2026] v2 — padding ajouté aux cartes « conducteur » et « Payez d'abord votre envoi » : OceanCard n'a pas de padding de base,
// leur contenu touchait le cadre.
//
// [09/10/2026] v1 — « Trouver un conducteur » : une fois son colis payé, le client peut chercher lui-même les conducteurs qui font
// la route et leur envoyer une invitation (email, notification, bannière sur leur accueil). L'annonce à tous les conducteurs
// continue : le premier qui accepte, invité ou non, prend le colis.
//
// Écran volontairement sobre : les deux villes (arrivée seule suffit), la liste des conducteurs, un bouton « Inviter ».
// Véhicule, villes traversées et heure de passage sont sous « Voir tous les détails ».
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  IconAlertTriangle,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconChevronUp,
  IconCircleCheck,
  IconSearch,
  IconStarFilled,
  IconX,
} from '@tabler/icons-react-native';
import { AppText, Avatar, ScreenContainer } from '@/components/ui';
import { OceanButton, OceanCard, OceanEmpty, OceanPill } from '@/components/ocean/OceanKit';
import { OceanHeroHeader } from '@/components/ocean/OceanHeroHeader';
import { colors, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { useCitySelectionStore } from '@/stores/citySelectionStore';
import { useShipment } from '@/hooks/useShipments';
import { useDriverSearch, useInviteDrivers } from '@/hooks/useShipmentInvitations';
import { ApiError } from '@/services/api/ApiError';
import { formatDateLong, formatTime } from '@/utils/date';
import type { DriverSearchResult } from '@/types/shipments.types';
import { useT } from '@/i18n';

const ORIGIN_FIELD = 'find-driver-origin';
const DESTINATION_FIELD = 'find-driver-destination';

interface CityChoice {
  id: string;
  name: string;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function RouteField({
  label,
  value,
  placeholder,
  onPress,
  onClear,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  onClear?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label} : ${value ?? placeholder}`}
      style={({ pressed }) => [styles.field, value ? styles.fieldActive : null, pressed && styles.pressed]}
    >
      <View style={styles.fieldText}>
        <AppText variant="xs" color="textMuted">
          {label}
        </AppText>
        <AppText variant="base" weight="semibold" color={value ? OCEAN.deep : 'textSecondary'} numberOfLines={1}>
          {value ?? placeholder}
        </AppText>
      </View>
      {value && onClear ? (
        <Pressable onPress={onClear} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Effacer ${label.toLowerCase()}`}>
          <IconX size={16} color={colors.textSecondary} />
        </Pressable>
      ) : (
        <IconChevronRight size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

function DriverCard({
  result,
  selected,
  showDetails,
  onToggle,
}: {
  result: DriverSearchResult;
  selected: boolean;
  showDetails: boolean;
  onToggle: () => void;
}) {
  const t = useT();
  const { driver } = result;
  const initials = `${driver.firstName[0] ?? ''}${driver.lastName[0] ?? ''}`;
  const alreadyInvited = result.invitationStatus !== null && result.invitationStatus !== 'EXPIRED';
  const declined = result.invitationStatus === 'DECLINED';

  return (
    <OceanCard
      onPress={alreadyInvited ? undefined : onToggle}
      style={[styles.driverCard, selected && styles.driverCardSelected, alreadyInvited && styles.driverCardMuted]}
      accessibilityLabel={`${driver.firstName} ${driver.lastName}`}
    >
      <View style={styles.driverRow}>
        <Avatar initials={initials} imageUri={driver.photoUrl} size={46} />
        <View style={styles.driverText}>
          <AppText variant="base" weight="bold" numberOfLines={1}>
            {driver.firstName} {driver.lastName}
          </AppText>
          <AppText variant="sm" color="textSecondary" numberOfLines={1}>
            {t('Part le {dateLong} à {time}', { dateLong: formatDateLong(result.departureAt), time: formatTime(result.departureAt) })}
          </AppText>
        </View>
        {alreadyInvited ? (
          <OceanPill label={declined ? t('A refusé') : result.invitationStatus === 'ACCEPTED' ? t('A accepté') : t('Invité')} tone={declined ? 'neutral' : 'success'} />
        ) : (
          <View style={[styles.check, selected && styles.checkOn]}>{selected ? <IconCheck size={14} color={OCEAN.onDark} /> : null}</View>
        )}
      </View>

      {showDetails ? (
        <View style={styles.details}>
          <AppText variant="sm">
            {result.originCityName} → {result.destinationCityName}
          </AppText>
          {result.viaCityNames.length > 0 ? (
            <AppText variant="xs" color="textSecondary">
              {t('Passe par {viaCityNames}', { viaCityNames: result.viaCityNames.join(', ') })}
            </AppText>
          ) : null}
          <AppText variant="xs" color="textSecondary">
            {t('Passage : {capitalize} vers {time}', { capitalize: capitalize(formatDateLong(result.passingAt)), time: formatTime(result.passingAt) })}
          </AppText>
          {result.vehicle ? (
            <AppText variant="xs" color="textSecondary">
              {[result.vehicle.brand, result.vehicle.model, result.vehicle.color].filter(Boolean).join(' · ')}
            </AppText>
          ) : null}
          <View style={styles.ratingRow}>
            {driver.averageRating ? (
              <>
                <IconStarFilled size={12} color={colors.accent} />
                <AppText variant="xs" color="textSecondary">
                  {t('{averageRating} · {completedTripsCount} trajets effectués', { averageRating: driver.averageRating.toFixed(1), completedTripsCount: driver.completedTripsCount })}
                </AppText>
              </>
            ) : (
              <AppText variant="xs" color="textSecondary">
                {t('Nouveau conducteur')}
              </AppText>
            )}
          </View>
        </View>
      ) : null}
    </OceanCard>
  );
}

export default function FindDriverScreen() {
  const t = useT();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: shipment, isLoading: shipmentLoading } = useShipment(id);

  const [origin, setOrigin] = useState<CityChoice | null>(null);
  const [destination, setDestination] = useState<CityChoice | null>(null);
  const [prefilled, setPrefilled] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [showDetails, setShowDetails] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  const selection = useCitySelectionStore((state) => state.selection);
  const consumeSelection = useCitySelectionStore((state) => state.consume);
  const openCityPicker = useCitySelectionStore((state) => state.openFor);

  // Villes de l'envoi d'office : le client n'a rien à saisir pour la plupart des cas, et peut effacer le départ.
  useEffect(() => {
    if (!shipment || prefilled) return;
    const sender = shipment.senderLocation?.city;
    const recipient = shipment.recipientLocation?.city;
    if (sender) setOrigin({ id: sender.id, name: sender.name });
    if (recipient) setDestination({ id: recipient.id, name: recipient.name });
    setPrefilled(true);
  }, [shipment, prefilled]);

  useEffect(() => {
    if (!selection) return;
    if (selection.field === ORIGIN_FIELD) setOrigin({ id: selection.city.id, name: selection.city.name });
    else if (selection.field === DESTINATION_FIELD) setDestination({ id: selection.city.id, name: selection.city.name });
    else return;
    setSelected([]);
    consumeSelection();
  }, [selection, consumeSelection]);

  const search = useDriverSearch(
    id,
    destination ? { destinationCityId: destination.id, ...(origin ? { originCityId: origin.id } : {}) } : null,
  );
  const invite = useInviteDrivers(id);

  if (shipmentLoading || !shipment) {
    return (
      <ScreenContainer maxWidth="detail" style={styles.center}>
        <ActivityIndicator color={OCEAN.base} />
      </ScreenContainer>
    );
  }

  const results = search.data ?? [];
  const canInvite = shipment.status === 'SEARCHING_DRIVER';
  const selectable = results.filter((r) => r.invitationStatus === null || r.invitationStatus === 'EXPIRED');

  function pickCity(field: string) {
    openCityPicker(field);
    router.push('/(customer)/select-city');
  }

  function toggle(tripId: string) {
    setFeedback(null);
    setSelected((current) => (current.includes(tripId) ? current.filter((value) => value !== tripId) : [...current, tripId]));
  }

  function sendInvitations() {
    setFeedback(null);
    invite.mutate(selected, {
      onSuccess: (result) => {
        setSelected([]);
        setFeedback({
          tone: 'success',
          text:
            result.invited > 0
              ? t.n(result.invited, 'Invitation envoyée à {count} conducteur. Vous serez prévenu dès que l’un d’eux accepte.', 'Invitation envoyée à {count} conducteurs. Vous serez prévenu dès que l’un d’eux accepte.')
              : t('Ces conducteurs ont déjà reçu votre invitation.'),
        });
      },
      onError: (error) =>
        setFeedback({
          tone: 'error',
          text: error instanceof ApiError ? error.message : t('Impossible d’envoyer l’invitation. Réessayez.'),
        }),
    });
  }

  return (
    <ScreenContainer
      scroll
      maxWidth="detail"
      footer={
        canInvite && selectable.length > 0 ? (
          <OceanButton
            label={selected.length > 0 ? t.n(selected.length, 'Inviter {count} conducteur', 'Inviter {count} conducteurs') : t('Choisissez un conducteur')}
            onPress={sendInvitations}
            disabled={selected.length === 0}
            loading={invite.isPending}
          />
        ) : undefined
      }
    >
      <OceanHeroHeader
        title={t('Trouver un conducteur')}
        subtitle={t('Invitez ceux qui font déjà la route')}
        icon={<IconSearch />}
        onBack={() => router.back()}
      />

      {!canInvite ? (
        <OceanCard style={styles.notice}>
          <AppText variant="sm" weight="semibold" color={OCEAN.deep}>
            {shipment.status === 'CREATED' ? t('Payez d’abord votre envoi') : t('Votre colis a déjà un conducteur ou n’est plus en recherche')}
          </AppText>
          <AppText variant="xs" color="textSecondary">
            {shipment.status === 'CREATED'
              ? t('Une fois le paiement confirmé, vous pourrez inviter des conducteurs.')
              : t('Il n’y a plus d’invitation à envoyer.')}
          </AppText>
        </OceanCard>
      ) : (
        <>
          <View style={styles.fields}>
            <RouteField
              label={t('Départ (facultatif)')}
              value={origin?.name ?? null}
              placeholder={t('N’importe quelle ville')}
              onPress={() => pickCity(ORIGIN_FIELD)}
              onClear={() => {
                setOrigin(null);
                setSelected([]);
              }}
            />
            <RouteField
              label={t('Arrivée')}
              value={destination?.name ?? null}
              placeholder={t('Choisir la ville d’arrivée')}
              onPress={() => pickCity(DESTINATION_FIELD)}
            />
          </View>

          {feedback ? (
            <View style={[styles.feedback, feedback.tone === 'error' ? styles.feedbackError : styles.feedbackSuccess]}>
              {feedback.tone === 'error' ? (
                <IconAlertTriangle size={18} color={colors.danger} />
              ) : (
                <IconCircleCheck size={18} color={colors.successDark} />
              )}
              <AppText variant="sm" style={styles.feedbackText}>
                {feedback.text}
              </AppText>
            </View>
          ) : null}

          {!destination ? (
            <OceanEmpty
              icon={<IconSearch size={26} color={OCEAN.base} />}
              title={t('Où doit arriver votre colis ?')}
              text={t('Choisissez la ville d’arrivée. La ville de départ est facultative.')}
            />
          ) : search.isLoading ? (
            <ActivityIndicator color={OCEAN.base} style={styles.loader} />
          ) : search.isError ? (
            <OceanEmpty
              icon={<IconAlertTriangle size={26} color={colors.danger} />}
              title={t('Recherche impossible')}
              text={search.error instanceof ApiError ? search.error.message : t('Vérifiez votre connexion puis réessayez.')}
              action={<OceanButton label={t('Réessayer')} variant="outline" onPress={() => void search.refetch()} />}
            />
          ) : results.length === 0 ? (
            <OceanEmpty
              icon={<IconSearch size={26} color={OCEAN.base} />}
              title={t('Aucun conducteur pour le moment')}
              text={t('Aucun trajet publié ne correspond à ces villes et à vos dates. Votre colis reste visible de tous les conducteurs : l’un d’eux peut encore l’accepter.')}
            />
          ) : (
            <>
              <View style={styles.listHeader}>
                <AppText variant="md" weight="semibold">
                  {t.n(results.length, '{count} conducteur trouvé', '{count} conducteurs trouvés')}
                </AppText>
              </View>
              {results.map((result) => (
                <DriverCard
                  key={result.tripId}
                  result={result}
                  selected={selected.includes(result.tripId)}
                  showDetails={showDetails}
                  onToggle={() => toggle(result.tripId)}
                />
              ))}
              <OceanButton
                label={showDetails ? t('Masquer les détails') : t('Voir tous les détails')}
                variant="soft"
                icon={showDetails ? <IconChevronUp size={16} color={OCEAN.base} /> : <IconChevronDown size={16} color={OCEAN.base} />}
                onPress={() => setShowDetails((value) => !value)}
              />
            </>
          )}
        </>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  fields: { gap: spacing.xs + 2, marginBottom: spacing.md },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OCEAN.line,
    backgroundColor: colors.surface,
  },
  fieldActive: { borderColor: OCEAN.base, backgroundColor: OCEAN.mist },
  fieldText: { flex: 1, gap: 1 },
  notice: { gap: spacing.xs, padding: spacing.md },
  loader: { marginVertical: spacing.xl },
  listHeader: { marginBottom: spacing.sm },
  driverCard: { gap: spacing.sm, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1.5, borderColor: 'transparent' },
  driverCardSelected: { borderColor: OCEAN.base, backgroundColor: OCEAN.mist },
  driverCardMuted: { opacity: 0.7 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2 },
  driverText: { flex: 1, gap: 2 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: OCEAN.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: OCEAN.base, borderColor: OCEAN.base },
  details: { gap: 3, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: OCEAN.line },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  feedback: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 16,
    marginBottom: spacing.md,
  },
  feedbackError: { backgroundColor: '#FDE8E8' },
  feedbackSuccess: { backgroundColor: colors.successLight },
  feedbackText: { flex: 1 },
});
