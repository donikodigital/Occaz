// mobile/src/components/screens/ShipmentTrackingView.tsx
// [28/10/2026] v+ — Textes passés par t() (français / English UK / Português PT) ; logique inchangée.
// [10/10/2026] v1 — Affichage d'un suivi de colis, commun à la page publique (numéro de suivi, sans compte) et à l'espace de
// l'expéditeur : l'essentiel d'abord (où est le colis, où il en est), le détail ensuite (route ville par ville, historique daté).
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { IconChevronDown, IconChevronUp, IconHistory, IconMapPin, IconPackage, IconRoute } from '@tabler/icons-react-native';
import { AppText } from '@/components/ui';
import { OceanButton, OceanHeroCard, OceanSection } from '@/components/ocean/OceanKit';
import { colors, radius, spacing } from '@/theme';
import { OCEAN } from '@/theme/ocean';
import { formatDateShort, formatRelativeTime, formatTime } from '@/utils/date';
import { openInMaps } from '@/utils/maps';
import type { ShipmentTracking, TrackingJourneyPoint, TrackingLocation, TrackingOutcome } from '@/types/tracking.types';
import { useT, translate } from '@/i18n';

const KIND_LABELS: Record<TrackingJourneyPoint['kind'], string> = {
  get PICKUP() { return translate('Départ du colis'); },
  get STOP() { return translate('Ville traversée'); },
  get DELIVERY() { return translate('Livraison'); },
};

function heroColor(outcome: TrackingOutcome): string {
  if (outcome === 'DELIVERED') return colors.successDeep;
  if (outcome === 'CANCELLED') return colors.textSecondary;
  if (outcome === 'INCIDENT') return colors.danger;
  return OCEAN.deep;
}

/** « il y a 4 min » jusqu'à une heure, puis l'heure elle-même : « à 14:32 ». */
function ago(iso: string): string {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60_000;
  return minutes < 60 ? formatRelativeTime(iso) : translate('à {time}', { time: formatTime(iso) });
}

function when(iso: string): string {
  return `${formatDateShort(iso)} · ${formatTime(iso)}`;
}

function positionNote(location: TrackingLocation): string | null {
  if (location.source === 'GPS' && location.updatedAt) {
    const base = location.isStale ? translate('Dernière position connue {ago}', { ago: ago(location.updatedAt) }) : translate('Position en direct · mise à jour {ago}', { ago: ago(location.updatedAt) });
    return location.isApproximate ? translate('{base} · zone approximative', { base }) : base;
  }
  if (location.source === 'CITIES') return translate('Position déduite des villes traversées par le conducteur.');
  return null;
}

function ProgressBar({ steps }: { steps: ShipmentTracking['progress'] }) {
  return (
    <View style={styles.progress} accessibilityRole="progressbar">
      {steps.map((step, index) => (
        <View key={step.key} style={styles.progressStep}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressLine, index === 0 && styles.progressLineHidden, step.state !== 'TODO' && styles.progressLineDone]} />
            <View style={[styles.progressDot, step.state === 'DONE' && styles.progressDotDone, step.state === 'CURRENT' && styles.progressDotCurrent]} />
            <View
              style={[
                styles.progressLine,
                index === steps.length - 1 && styles.progressLineHidden,
                steps[index + 1] && steps[index + 1].state !== 'TODO' && styles.progressLineDone,
              ]}
            />
          </View>
          <AppText variant="xs" weight={step.state === 'CURRENT' ? 'bold' : 'regular'} color={step.state === 'TODO' ? 'textMuted' : OCEAN.deep} align="center">
            {step.label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function JourneyRow({ point, isLast }: { point: TrackingJourneyPoint; isLast: boolean }) {
  const t = useT();
  return (
    <View style={styles.journeyRow}>
      <View style={styles.journeyColumn}>
        <View style={[styles.journeyDot, point.state === 'DONE' && styles.journeyDotDone, point.state === 'NEXT' && styles.journeyDotNext]} />
        {!isLast ? <View style={[styles.journeyLine, point.state === 'DONE' && styles.journeyLineDone]} /> : null}
      </View>
      <View style={styles.journeyText}>
        <AppText variant="sm" weight={point.state === 'TODO' ? 'regular' : 'semibold'} color={point.state === 'TODO' ? 'textSecondary' : 'textPrimary'}>
          {point.cityName}
        </AppText>
        <AppText variant="xs" color="textSecondary">
          {KIND_LABELS[point.kind]}
          {point.state === 'NEXT' ? t(' · prochaine étape') : ''}
        </AppText>
      </View>
      {point.at ? (
        <AppText variant="xs" color="textSecondary">
          {when(point.at)}
        </AppText>
      ) : null}
    </View>
  );
}

export function ShipmentTrackingView({ tracking }: { tracking: ShipmentTracking }) {
  const t = useT();
  const [showHistory, setShowHistory] = useState(false);
  const { location } = tracking;
  const note = positionNote(location);
  const hasCoordinates = location.latitude !== null && location.longitude !== null;
  const isActive = tracking.outcome === 'ACTIVE';

  return (
    <>
      <OceanHeroCard style={[styles.hero, { backgroundColor: heroColor(tracking.outcome) }]}>
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <IconPackage size={26} color={OCEAN.onDark} />
          </View>
          <View style={styles.heroText}>
            <AppText variant="xs" color={OCEAN.sky}>
              {t('Colis {trackingNumberFormatted}', { trackingNumberFormatted: tracking.trackingNumberFormatted })}
            </AppText>
            <AppText variant="lg" weight="bold" color={OCEAN.onDark}>
              {tracking.headline}
            </AppText>
          </View>
        </View>
        <AppText variant="sm" color={OCEAN.onDark}>
          {tracking.pickupCity} → {tracking.deliveryCity}
          {tracking.parcelsCount > 1 ? t(' · {parcelsCount} colis', { parcelsCount: tracking.parcelsCount }) : ''}
        </AppText>
      </OceanHeroCard>

      {tracking.outcome === 'ACTIVE' || tracking.outcome === 'DELIVERED' ? <ProgressBar steps={tracking.progress} /> : null}

      {isActive ? (
        <OceanSection icon={<IconMapPin size={17} color={OCEAN.base} />} title={t('Où est mon colis ?')}>
          <AppText variant="base" weight="semibold" color={OCEAN.deep}>
            {location.label}
          </AppText>
          {note ? (
            <AppText variant="xs" color="textSecondary">
              {note}
            </AppText>
          ) : null}
          {hasCoordinates ? (
            <OceanButton
              label={t('Voir sur la carte')}
              variant="soft"
              icon={<IconMapPin size={16} color={OCEAN.base} />}
              onPress={() => void openInMaps(location.latitude!, location.longitude!, t('Colis Occa’Z'))}
            />
          ) : null}
        </OceanSection>
      ) : null}

      {tracking.journey.length > 1 && tracking.outcome !== 'CANCELLED' ? (
        <OceanSection icon={<IconRoute size={17} color={OCEAN.base} />} title={t('Route du colis')}>
          <View>
            {tracking.journey.map((point, index) => (
              <JourneyRow key={`${point.cityName}-${index}`} point={point} isLast={index === tracking.journey.length - 1} />
            ))}
          </View>
        </OceanSection>
      ) : null}

      {tracking.events.length > 0 ? (
        <OceanSection
          icon={<IconHistory size={17} color={OCEAN.base} />}
          title={t('Historique')}
          action={
            <Pressable
              onPress={() => setShowHistory((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={showHistory ? t("Masquer l'historique") : t("Afficher l'historique")}
              hitSlop={8}
            >
              {showHistory ? <IconChevronUp size={18} color={OCEAN.base} /> : <IconChevronDown size={18} color={OCEAN.base} />}
            </Pressable>
          }
        >
          {showHistory ? (
            tracking.events.map((event, index) => (
              <View key={`${event.status}-${event.at}-${index}`} style={styles.eventRow}>
                <AppText variant="sm" weight={index === 0 ? 'semibold' : 'regular'} style={styles.eventLabel}>
                  {event.label}
                </AppText>
                <AppText variant="xs" color="textSecondary">
                  {when(event.at)}
                </AppText>
              </View>
            ))
          ) : (
            <Pressable onPress={() => setShowHistory(true)} accessibilityRole="button">
              <AppText variant="sm" color="textSecondary">
                {t('Dernière mise à jour : {label} · {when}', { label: tracking.events[0].label, when: when(tracking.events[0].at) })}
              </AppText>
            </Pressable>
          )}
        </OceanSection>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { gap: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: { flex: 1, gap: 2 },

  progress: { flexDirection: 'row', paddingVertical: spacing.xs },
  progressStep: { flex: 1, alignItems: 'center', gap: spacing.xxs },
  progressTrack: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  progressLine: { flex: 1, height: 3, backgroundColor: OCEAN.line },
  progressLineHidden: { backgroundColor: 'transparent' },
  progressLineDone: { backgroundColor: OCEAN.base },
  progressDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: OCEAN.line },
  progressDotDone: { backgroundColor: OCEAN.base },
  progressDotCurrent: { backgroundColor: OCEAN.onDark, borderWidth: 4, borderColor: OCEAN.base },

  journeyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, minHeight: 52 },
  journeyColumn: { width: 18, alignItems: 'center' },
  journeyDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: OCEAN.line, marginTop: 3 },
  journeyDotDone: { backgroundColor: OCEAN.base },
  journeyDotNext: { backgroundColor: OCEAN.onDark, borderWidth: 3, borderColor: OCEAN.bright },
  journeyLine: { flex: 1, width: 3, backgroundColor: OCEAN.line, marginVertical: 2 },
  journeyLineDone: { backgroundColor: OCEAN.base },
  journeyText: { flex: 1, paddingBottom: spacing.sm },

  eventRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: spacing.xxs },
  eventLabel: { flex: 1 },
});
