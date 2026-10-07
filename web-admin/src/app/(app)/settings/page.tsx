// web-admin/src/app/(app)/settings/page.tsx
//
// v4 — Nouveau thème « Connexion et SMS » : durée et essais des codes, limites de demandes, plafonds quotidiens, SMS de
//   remise, pays acceptés et délai entre deux changements de numéro. Ces réglages étaient jusqu'ici dans des variables
//   d'environnement ; ils se modifient maintenant ici (le backend les lit à chaque demande, repli sur l'environnement).
//   Nouvelles unités : secondes, jours, nombre ; nouveau champ « indicatifs » (liste, vide = tous les pays).
//   Nouveau thème « Tâches automatiques » : interrupteurs des tâches d'expiration (trajets, réservations, envois) et plafond
//   des SMS de notification par utilisateur.
// v3 — Refonte « sans jargon » (réservée au SuperAdmin : SETTINGS_UPDATE n'est
// accordée à aucun des rôles Support du seed, voir rbac.seed.ts).
//   - Plus de clés techniques (booking.unpaid_expiry_minutes), de police
//     « code » ni de JSON à l'écran : chaque réglage connu a un nom clair, une
//     phrase d'explication et une unité (minutes, heures, km, %, montant…).
//   - Tous les réglages que le backend sait lire sont présents d'emblée, avec
//     leur valeur par défaut tant qu'ils n'ont pas été personnalisés : il n'y a
//     plus rien à « ajouter » pour les modifier, on clique sur la carte.
//   - Regroupés par thème (Réservations, Trajets, Tarifs des envois, Retraits…)
//     avec recherche et pastilles de navigation.
//   - Modification en modale : champ avec son unité et boutons − / +, bouton
//     « Rétablir la valeur par défaut », interrupteur pour les options
//     Oui / Non. Les options Oui / Non sont enregistrées dans le format
//     attendu par le backend (true/false ou 1/0).
//   - Les réglages inconnus (ajoutés à la main) restent gérables dans
//     « Autres réglages » ; le bouton « Avancé » permet d'en créer un.
//   - Les taux de change ont leur propre page : une carte y renvoie.
// v2 — Refonte complète : groupes par domaine, valeurs typées, modale d'ajout.

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAdjustments,
  IconArrowBackUp,
  IconArrowsExchange,
  IconCash,
  IconChevronRight,
  IconClockHour4,
  IconDeviceMobileMessage,
  IconGauge,
  IconGift,
  IconHash,
  IconMinus,
  IconPackage,
  IconPercentage,
  IconPlus,
  IconRefresh,
  IconRoute,
  IconRuler2,
  IconScale,
  IconSettings,
  IconTicket,
  IconToggleRight,
  IconTrash,
  IconWallet,
  IconWorld,
} from '@tabler/icons-react';
import { Button, Modal, TextArea, TextField } from '@/components/ui';
import {
  Chip,
  EmptyState,
  FilterChips,
  FormError,
  FormSection,
  IconTile,
  ListCard,
  ListSkeleton,
  Notice,
  PageHero,
  SavedNotice,
  SearchField,
  SegmentedControl,
  ToggleRow,
  type Tone,
} from '@/components/admin/AdminUi';
import { usePlatformSettings, useRemovePlatformSetting, useUpsertPlatformSetting } from '@/hooks/usePlatformSettings';
import { ApiError } from '@/services/api/ApiError';
import { formatNumber } from '@/utils/money';

type SettingItem = NonNullable<ReturnType<typeof usePlatformSettings>['data']>[number];
type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

// ---------------------------------------------------------------------------
// Catalogue des réglages connus du backend
// ---------------------------------------------------------------------------

type Kind =
  | 'number'
  | 'money'
  | 'percent'
  | 'hours'
  | 'minutes'
  | 'seconds'
  | 'days'
  | 'count'
  | 'km'
  | 'kmh'
  | 'factor'
  | 'prefixes'
  | 'flag'
  | 'flag01';

/** Unité affichée, pas de variation des boutons − / +, icône de la carte. */
const KIND_INFO: Record<Kind, { unit: string; step: number; icon: IconComponent }> = {
  number: { unit: '', step: 100, icon: IconHash },
  money: { unit: '', step: 500, icon: IconCash },
  percent: { unit: '%', step: 1, icon: IconPercentage },
  hours: { unit: 'h', step: 1, icon: IconClockHour4 },
  minutes: { unit: 'min', step: 5, icon: IconClockHour4 },
  seconds: { unit: 's', step: 30, icon: IconClockHour4 },
  days: { unit: 'j', step: 1, icon: IconClockHour4 },
  count: { unit: '', step: 1, icon: IconHash },
  km: { unit: 'km', step: 1, icon: IconRuler2 },
  kmh: { unit: 'km/h', step: 5, icon: IconGauge },
  factor: { unit: '×', step: 0.1, icon: IconScale },
  prefixes: { unit: '', step: 1, icon: IconWorld },
  flag: { unit: '', step: 1, icon: IconToggleRight },
  flag01: { unit: '', step: 1, icon: IconToggleRight },
};

type GroupId =
  | 'reservations'
  | 'trips'
  | 'shipmentPrices'
  | 'shipmentCalc'
  | 'shipmentDelays'
  | 'payouts'
  | 'referral'
  | 'otp'
  | 'jobs'
  | 'other';

const GROUPS: { id: GroupId; title: string; description: string; icon: IconComponent }[] = [
  { id: 'reservations', title: 'Réservations', description: 'Paiement et expiration des réservations.', icon: IconTicket },
  { id: 'trips', title: 'Trajets', description: 'Recherche, expiration et calcul des étapes.', icon: IconRoute },
  { id: 'shipmentPrices', title: 'Tarifs des envois', description: 'Prix de base, poids, distance et options.', icon: IconCash },
  { id: 'shipmentCalc', title: 'Calcul des envois', description: 'Poids volumétrique et distances.', icon: IconPackage },
  { id: 'shipmentDelays', title: 'Délais et alertes des envois', description: 'Durées d’attente et notifications.', icon: IconClockHour4 },
  { id: 'payouts', title: 'Retraits', description: 'Retraits des conducteurs vers leur compte Mobile Money.', icon: IconWallet },
  { id: 'referral', title: 'Parrainage', description: 'Récompense des parrains.', icon: IconGift },
  { id: 'otp', title: 'Connexion et SMS', description: 'Codes reçus par SMS, limites d’envoi et pays acceptés.', icon: IconDeviceMobileMessage },
  { id: 'jobs', title: 'Tâches automatiques', description: 'Expirations réalisées toutes seules par la plateforme.', icon: IconRefresh },
  { id: 'other', title: 'Autres réglages', description: 'Réglages ajoutés manuellement.', icon: IconSettings },
];

interface Known {
  key: string;
  title: string;
  help: string;
  kind: Kind;
  group: GroupId;
  /** Valeur appliquée par le backend tant que le réglage n'est pas personnalisé. */
  defaultValue: number | boolean | string;
  /** Texte affiché à la place de la valeur quand elle vaut zéro (ex. « Aucun plafond »). */
  zeroLabel?: string; // aussi utilisé pour une liste d’indicatifs vide (« Tous les pays »)
  /** Minimum accepté (0 par défaut). */
  min?: number;
  /** Explications des deux états d'une option Oui / Non. */
  onText?: string;
  offText?: string;
}

const KNOWN: Known[] = [
  {
    key: 'booking.unpaid_expiry_minutes',
    title: 'Délai pour payer une réservation',
    help: 'Une réservation non payée est annulée automatiquement après ce délai, ou au départ du trajet si celui-ci arrive avant.',
    kind: 'minutes',
    group: 'reservations',
    defaultValue: 15,
    min: 1,
  },
  {
    key: 'trip.search_radius_km',
    title: 'Rayon de recherche des trajets',
    help: 'Distance autour du lieu choisi dans laquelle l’application cherche des trajets pour le client.',
    kind: 'km',
    group: 'trips',
    defaultValue: 5,
    min: 1,
  },
  {
    key: 'trip.stale_expiry_hours',
    title: 'Expiration des trajets sans réservation',
    help: 'Un trajet publié sans aucune réservation est annulé automatiquement ce nombre d’heures après son heure de départ.',
    kind: 'hours',
    group: 'trips',
    defaultValue: 24,
    min: 1,
  },
  {
    key: 'trip.segment_price_rounding',
    title: 'Arrondi du prix des étapes',
    help: 'Le prix d’une étape intermédiaire est arrondi à ce montant près.',
    kind: 'money',
    group: 'trips',
    defaultValue: 500,
    min: 1,
  },
  {
    key: 'trip.segment_min_price',
    title: 'Prix minimum d’une étape',
    help: 'Une étape très courte ne coûte jamais moins que ce montant.',
    kind: 'money',
    group: 'trips',
    defaultValue: 500,
    min: 1,
  },
  {
    key: 'trip.average_speed_kmh',
    title: 'Vitesse moyenne estimée',
    help: 'Sert à estimer la durée du trajet et les heures de passage dans chaque ville.',
    kind: 'kmh',
    group: 'trips',
    defaultValue: 55,
    min: 1,
  },
  {
    key: 'trip.road_distance_factor',
    title: 'Coefficient de distance par la route',
    help: 'Multiplie la distance à vol d’oiseau pour approcher la distance réelle par la route (trajets).',
    kind: 'factor',
    group: 'trips',
    defaultValue: 1.3,
    min: 1,
  },
  {
    key: 'shipment.base_price',
    title: 'Prix de base d’un envoi',
    help: 'Montant de départ de tout envoi, avant d’ajouter le poids et la distance.',
    kind: 'money',
    group: 'shipmentPrices',
    defaultValue: 2000,
  },
  {
    key: 'shipment.price_per_kg',
    title: 'Prix par kilo',
    help: 'Facturé sur le plus grand du poids réel et du poids volumétrique.',
    kind: 'money',
    group: 'shipmentPrices',
    defaultValue: 1000,
  },
  {
    key: 'shipment.price_per_km',
    title: 'Prix par kilomètre',
    help: 'Montant facturé pour chaque kilomètre parcouru.',
    kind: 'money',
    group: 'shipmentPrices',
    defaultValue: 300,
  },
  {
    key: 'shipment.urgent_surcharge',
    title: 'Supplément pour un envoi urgent',
    help: 'Montant ajouté au prix quand le client demande une livraison urgente.',
    kind: 'money',
    group: 'shipmentPrices',
    defaultValue: 5000,
  },
  {
    key: 'shipment.declared_value_rate_percent',
    title: 'Frais sur la valeur déclarée',
    help: 'Pourcentage de la valeur déclarée d’un colis, ajouté au prix pour couvrir sa manutention et son assurance.',
    kind: 'percent',
    group: 'shipmentPrices',
    defaultValue: 1,
  },
  {
    key: 'shipment.declared_value_min_fee',
    title: 'Frais minimum sur la valeur déclarée',
    help: 'Les frais sur la valeur déclarée ne sont jamais inférieurs à ce montant.',
    kind: 'money',
    group: 'shipmentPrices',
    defaultValue: 0,
    zeroLabel: 'Aucun minimum',
  },
  {
    key: 'shipment.volumetric_divisor',
    title: 'Diviseur du poids volumétrique',
    help: 'Longueur × largeur × hauteur du colis (en cm) divisée par ce nombre donne son poids volumétrique en kilos.',
    kind: 'number',
    group: 'shipmentCalc',
    defaultValue: 5000,
    min: 1,
  },
  {
    key: 'shipment.road_distance_factor',
    title: 'Coefficient de distance par la route',
    help: 'Multiplie la distance à vol d’oiseau pour approcher la distance réelle par la route (envois).',
    kind: 'factor',
    group: 'shipmentCalc',
    defaultValue: 1.3,
    min: 1,
  },
  {
    key: 'shipment.min_distance_km',
    title: 'Distance minimale facturée',
    help: 'Une livraison dans une même ville est facturée comme si elle faisait au moins cette distance.',
    kind: 'km',
    group: 'shipmentCalc',
    defaultValue: 2,
  },
  {
    key: 'shipment.extension_grace_hours',
    title: 'Délai de prolongation d’une demande',
    help: 'Temps laissé au client pour prolonger une demande restée sans conducteur, avant son remboursement automatique.',
    kind: 'hours',
    group: 'shipmentDelays',
    defaultValue: 24,
    min: 1,
  },
  {
    key: 'shipment.unpaid_expiry_hours',
    title: 'Délai pour payer un envoi',
    help: 'Un envoi jamais payé est annulé automatiquement après ce délai.',
    kind: 'hours',
    group: 'shipmentDelays',
    defaultValue: 24,
    min: 1,
  },
  {
    key: 'shipment.dispatch_email_enabled',
    title: 'E-mail aux conducteurs pour un nouvel envoi',
    help: 'Prévenir aussi les conducteurs par e-mail lorsqu’une nouvelle demande d’envoi est publiée.',
    kind: 'flag01',
    group: 'shipmentDelays',
    defaultValue: true,
    onText: 'Les conducteurs reçoivent une notification et un e-mail.',
    offText: 'Les conducteurs reçoivent seulement la notification dans l’application.',
  },
  {
    key: 'payout.auto_enabled',
    title: 'Retraits automatiques',
    help: 'Choisis si les retraits des conducteurs sont envoyés tout de suite ou validés par le support.',
    kind: 'flag',
    group: 'payouts',
    defaultValue: true,
    onText: 'Le retrait est envoyé tout de suite sur le compte Mobile Money du conducteur, sans validation du support.',
    offText: 'Chaque retrait attend la validation de l’équipe support.',
  },
  {
    key: 'payout.auto_max_amount',
    title: 'Plafond des retraits automatiques',
    help: 'Au-dessus de ce montant, le retrait attend la validation de l’équipe. Mets zéro pour ne fixer aucune limite.',
    kind: 'money',
    group: 'payouts',
    defaultValue: 0,
    zeroLabel: 'Aucun plafond',
  },
  {
    key: 'referral.reward_amount',
    title: 'Récompense d’un parrainage',
    help: 'Montant crédité au parrain (conducteur) à la première prestation payée de son filleul.',
    kind: 'money',
    group: 'referral',
    defaultValue: 10000,
  },
  {
    key: 'otp.expiry_seconds',
    title: 'Durée de validité d’un code SMS',
    help: 'Temps dont la personne dispose pour saisir le code reçu par SMS (connexion, remise, changement de numéro). 300 secondes = 5 minutes.',
    kind: 'seconds',
    group: 'otp',
    defaultValue: 300,
    min: 30,
  },
  {
    key: 'otp.max_attempts',
    title: 'Essais autorisés par code',
    help: 'Après ce nombre d’erreurs de saisie, le code est bloqué et la personne doit en redemander un.',
    kind: 'count',
    group: 'otp',
    defaultValue: 3,
    min: 1,
  },
  {
    key: 'otp.request_limit',
    title: 'Codes demandés à la suite',
    help: 'Nombre de codes qu’un même numéro peut demander pendant la durée indiquée juste en dessous.',
    kind: 'count',
    group: 'otp',
    defaultValue: 5,
    min: 1,
  },
  {
    key: 'otp.request_window_minutes',
    title: 'Durée de cette limite',
    help: 'Quand un numéro a atteint le nombre de codes ci-dessus, il doit patienter cette durée avant d’en redemander.',
    kind: 'minutes',
    group: 'otp',
    defaultValue: 15,
    min: 1,
  },
  {
    key: 'otp.daily_limit_per_phone',
    title: 'Codes par numéro et par jour',
    help: 'Nombre maximum de codes de connexion envoyés à un même numéro sur 24 heures. Mets zéro pour ne fixer aucune limite.',
    kind: 'count',
    group: 'otp',
    defaultValue: 10,
    zeroLabel: 'Aucune limite',
  },
  {
    key: 'otp.daily_limit_global',
    title: 'Codes de connexion par jour (toute la plateforme)',
    help: 'Protège ton crédit SMS : une fois ce nombre atteint sur 24 heures, les nouvelles demandes sont refusées. Mets zéro pour ne fixer aucune limite.',
    kind: 'count',
    group: 'otp',
    defaultValue: 2000,
    zeroLabel: 'Aucune limite',
  },
  {
    key: 'otp.handover_sms_daily_limit',
    title: 'SMS de remise par réservation ou envoi',
    help: 'Nombre maximum de SMS envoyés pour une même étape (prise en charge, dépose, colis) sur 24 heures. Au-delà, le code reste visible dans l’application. Mets zéro pour ne fixer aucune limite.',
    kind: 'count',
    group: 'otp',
    defaultValue: 5,
    zeroLabel: 'Aucune limite',
  },
  {
    key: 'otp.allowed_phone_prefixes',
    title: 'Pays acceptés pour recevoir un code',
    help: 'Indicatifs des numéros autorisés, par exemple +224 pour la Guinée. Les autres numéros sont refusés avant tout envoi de SMS. Laisse vide pour accepter tous les pays.',
    kind: 'prefixes',
    group: 'otp',
    defaultValue: '*',
    zeroLabel: 'Tous les pays',
  },
  {
    key: 'sms.notification_daily_limit_per_user',
    title: 'SMS de notification par personne et par jour',
    help: 'Nombre maximum de SMS d’information (paiement confirmé, litige…) envoyés à une même personne sur 24 heures. Les notifications dans l’application ne sont pas limitées. Mets zéro pour ne fixer aucune limite.',
    kind: 'count',
    group: 'otp',
    defaultValue: 10,
    zeroLabel: 'Aucune limite',
  },
  {
    key: 'auth.phone_change_cooldown_days',
    title: 'Délai entre deux changements de numéro',
    help: 'Une personne qui vient de changer de numéro doit attendre ce délai avant de pouvoir le refaire. Mets zéro pour ne fixer aucun délai.',
    kind: 'days',
    group: 'otp',
    defaultValue: 30,
    zeroLabel: 'Aucun délai',
  },
  {
    key: 'jobs.booking_expiry_enabled',
    title: 'Annulation des réservations non payées',
    help: 'Libère automatiquement les places des réservations qui n’ont pas été payées à temps.',
    kind: 'flag01',
    group: 'jobs',
    defaultValue: true,
    onText: 'Les réservations non payées sont annulées toutes seules après le délai prévu.',
    offText: 'Pause : les réservations non payées restent bloquées, et leurs places aussi, jusqu’à la réactivation.',
  },
  {
    key: 'jobs.trip_expiry_enabled',
    title: 'Clôture des trajets sans réservation',
    help: 'Clôture automatiquement les trajets publiés dont le départ est largement passé sans aucune réservation.',
    kind: 'flag01',
    group: 'jobs',
    defaultValue: true,
    onText: 'Les trajets restés sans réservation après leur départ sont clôturés tout seuls.',
    offText: 'Pause : ces trajets restent affichés comme publiés jusqu’à la réactivation.',
  },
  {
    key: 'jobs.shipment_window_enabled',
    title: 'Fin de période des envois',
    help: 'Invite le client à prolonger quand aucun conducteur n’a pris l’envoi, rembourse sans réponse et annule les envois jamais payés.',
    kind: 'flag01',
    group: 'jobs',
    defaultValue: true,
    onText: 'Les envois sans conducteur ou non payés sont traités automatiquement à la fin de leur période.',
    offText: 'Pause : aucune invitation, aucun remboursement automatique ni annulation d’envoi jusqu’à la réactivation.',
  },
];

const KNOWN_BY_KEY = new Map(KNOWN.map((item) => [item.key, item]));

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanize(code: string): string {
  return capitalize(code.replace(/[_.-]+/g, ' ').toLowerCase().trim());
}

function isFlag(kind: Kind): boolean {
  return kind === 'flag' || kind === 'flag01';
}

/** Une option Oui / Non est activée sauf si elle vaut explicitement false ou 0 (comme le lit le backend). */
function isOn(value: unknown): boolean {
  return value !== false && value !== 0;
}

/**
 * « +224, 33 » → « +224, +33 » ; liste vide → « * » (tous les pays, valeur que le backend comprend comme « aucun filtre »).
 * Une entrée invalide renvoie `invalid` (le texte fautif) et une valeur vide.
 */
function normalizePrefixes(raw: string): { value: string; invalid: string | null } {
  const list: string[] = [];
  for (const part of raw.split(/[,;\s]+/)) {
    const entry = part.trim();
    if (!entry || entry === '*') continue;
    const prefix = entry.startsWith('+') ? entry : `+${entry}`;
    if (!/^\+\d{1,8}$/.test(prefix)) return { value: '', invalid: entry };
    if (!list.includes(prefix)) list.push(prefix);
  }
  return { value: list.length > 0 ? list.join(', ') : '*', invalid: null };
}

function prefixesKey(value: unknown): string {
  return typeof value === 'string' ? normalizePrefixes(value).value : '*';
}

function sameValue(kind: Kind, a: unknown, b: unknown): boolean {
  if (isFlag(kind)) return isOn(a) === isOn(b);
  if (kind === 'prefixes') return prefixesKey(a) === prefixesKey(b);
  return a === b;
}

function formatKnownValue(known: Known, value: unknown): string {
  if (isFlag(known.kind)) return isOn(value) ? 'Activé' : 'Désactivé';
  if (known.kind === 'prefixes') {
    const list = prefixesKey(value);
    return list === '*' ? (known.zeroLabel ?? 'Aucun filtre') : list;
  }
  if (typeof value !== 'number') return 'À vérifier';
  if (value === 0 && known.zeroLabel) return known.zeroLabel;
  const text = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 8 }).format(value);
  const unit = KIND_INFO[known.kind].unit;
  return unit ? `${text} ${unit}` : text;
}

function formatPlainValue(value: unknown): string {
  if (typeof value === 'number') return formatNumber(value);
  if (typeof value === 'boolean') return value ? 'Activé' : 'Désactivé';
  if (typeof value === 'string') return value;
  return 'Valeur avancée';
}

function roundTo(value: number, decimals = 8): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/[\s  ]/g, '').replace(',', '.');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

// ---------------------------------------------------------------------------
// Lignes affichées
// ---------------------------------------------------------------------------

interface Row {
  id: string;
  key: string;
  known: Known | null;
  stored: SettingItem | null;
  value: unknown;
  title: string;
  help: string;
  group: GroupId;
  isDefault: boolean;
}

function buildRows(items: SettingItem[]): Row[] {
  const byKey = new Map(items.map((item) => [item.key, item]));
  const rows: Row[] = KNOWN.map((known) => {
    const stored = byKey.get(known.key) ?? null;
    const value = stored ? stored.value : known.defaultValue;
    return {
      id: known.key,
      key: known.key,
      known,
      stored,
      value,
      title: known.title,
      help: known.help,
      group: known.group,
      isDefault: sameValue(known.kind, value, known.defaultValue),
    };
  });

  for (const item of items) {
    // Les taux de change et les prix des trajets (« Configuration frais trajets ») ont leur propre page ; les réglages
    // connus sont déjà ci-dessus. Les clés « trip_pricing.* » ne se modifient d'ailleurs pas ici : le serveur les refuse.
    if (KNOWN_BY_KEY.has(item.key) || item.key.startsWith('exchange_rate.') || item.key.startsWith('trip_pricing.')) continue;
    rows.push({
      id: item.key,
      key: item.key,
      known: null,
      stored: item,
      value: item.value,
      title: item.description?.trim() || humanize(item.key),
      help: 'Réglage ajouté manuellement.',
      group: 'other',
      isDefault: false,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Carte
// ---------------------------------------------------------------------------

function SettingCard({ row, onClick }: { row: Row; onClick: () => void }) {
  const known = row.known;
  const kindInfo = known ? KIND_INFO[known.kind] : null;
  const Icon = kindInfo ? kindInfo.icon : IconSettings;
  const flag = known ? isFlag(known.kind) : false;
  const on = isOn(row.value);
  const tone: Tone = flag ? (on ? 'success' : 'neutral') : 'primary';

  return (
    <ListCard onClick={onClick} tone={tone}>
      <div className="flex items-start gap-3">
        <IconTile tone={tone}>
          <Icon size={20} />
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-text-primary">{row.title}</p>
          <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">{row.help}</p>
        </div>
        <IconChevronRight size={18} className="mt-1 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-surface-muted/70 px-3 py-2">
        {flag ? (
          <Chip tone={on ? 'success' : 'neutral'}>{on ? 'Activé' : 'Désactivé'}</Chip>
        ) : (
          <span className="truncate text-lg font-bold leading-tight text-text-primary">
            {known ? formatKnownValue(known, row.value) : formatPlainValue(row.value)}
          </span>
        )}
        {known ? (
          row.isDefault ? (
            <span className="shrink-0 text-xs font-medium text-text-muted">Par défaut</span>
          ) : (
            <Chip tone="accent">Personnalisé</Chip>
          )
        ) : null}
      </div>
    </ListCard>
  );
}

// ---------------------------------------------------------------------------
// Modale de modification d'un réglage connu
// ---------------------------------------------------------------------------

function KnownSettingModal({
  open,
  onClose,
  row,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  row: Row | null;
  onSaved: (message: string) => void;
}) {
  const upsert = useUpsertPlatformSetting();
  const known = row?.known ?? null;

  const [raw, setRaw] = useState('');
  const [flag, setFlag] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open || !row || !row.known) return;
    if (isFlag(row.known.kind)) {
      setFlag(isOn(row.value));
      setRaw('');
    } else if (row.known.kind === 'prefixes') {
      const list = prefixesKey(row.value);
      setRaw(list === '*' ? '' : list);
    } else {
      setRaw(typeof row.value === 'number' ? String(row.value) : '');
    }
    setErrorMessage(undefined);
  }, [open, row]);

  if (!row || !known) return null;

  const info = KIND_INFO[known.kind];
  const flagMode = isFlag(known.kind);
  const minimum = known.min ?? 0;
  const parsed = parseNumber(raw);
  const prefixMode = known.kind === 'prefixes';
  const prefixResult = normalizePrefixes(raw);
  const defaultNumber = typeof known.defaultValue === 'number' ? known.defaultValue : null;
  const differsFromDefault = flagMode
    ? flag !== isOn(known.defaultValue)
    : prefixMode
      ? prefixResult.value !== prefixesKey(known.defaultValue)
      : parsed !== defaultNumber;
  const hasChanged = flagMode
    ? flag !== isOn(row.value)
    : prefixMode
      ? prefixResult.value !== prefixesKey(row.value)
      : parsed !== (typeof row.value === 'number' ? row.value : null);

  function nudge(direction: 1 | -1) {
    const current = parsed ?? 0;
    const next = Math.max(minimum, roundTo(current + direction * info.step));
    setRaw(String(next));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!known || !row) return;
    setErrorMessage(undefined);

    let value: unknown;
    if (flagMode) {
      value = known.kind === 'flag01' ? (flag ? 1 : 0) : flag;
    } else if (prefixMode) {
      if (prefixResult.invalid !== null) {
        setErrorMessage(`« ${prefixResult.invalid} » n’est pas un indicatif valide. Exemple : +224, +33.`);
        return;
      }
      value = prefixResult.value;
    } else {
      if (parsed === null) {
        setErrorMessage('Saisis un nombre, par exemple 25 ou 1,5.');
        return;
      }
      if (parsed < minimum) {
        setErrorMessage(minimum === 0 ? 'La valeur ne peut pas être négative.' : `La valeur doit être d’au moins ${formatNumber(minimum)}.`);
        return;
      }
      if (known.kind === 'percent' && parsed > 100) {
        setErrorMessage('Un pourcentage ne peut pas dépasser 100.');
        return;
      }
      value = parsed;
    }

    try {
      await upsert.mutateAsync({
        key: known.key,
        value,
        // La description n'est écrite qu'à la création : un réglage déjà présent garde la sienne.
        description: row.stored ? undefined : known.help,
      });
      onSaved(`« ${known.title} » est enregistré.`);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={known.title}
      description={known.help}
      zIndex={60}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" form="setting-form" loading={upsert.isPending} disabled={!hasChanged}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="setting-form" onSubmit={handleSubmit} className="space-y-5">
        {flagMode ? (
          <>
            <ToggleRow
              checked={flag}
              onChange={setFlag}
              label={flag ? 'Activé' : 'Désactivé'}
              description={flag ? known.onText : known.offText}
            />
            {differsFromDefault ? (
              <button
                type="button"
                onClick={() => setFlag(isOn(known.defaultValue))}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:text-primary-dark"
              >
                <IconArrowBackUp size={16} />
                Rétablir la valeur par défaut ({isOn(known.defaultValue) ? 'activé' : 'désactivé'})
              </button>
            ) : null}
          </>
        ) : prefixMode ? (
          <FormSection title="Indicatifs acceptés">
            <input
              type="text"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder="Tous les pays"
              aria-label="Indicatifs acceptés"
              className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 text-base font-semibold text-text-primary placeholder:font-normal placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-xs text-text-muted">
              Sépare les indicatifs par une virgule, par exemple « +224, +33 ». Laisse le champ vide pour accepter tous les pays.
            </p>
            {differsFromDefault ? (
              <button
                type="button"
                onClick={() => setRaw('')}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition hover:text-primary-dark"
              >
                <IconArrowBackUp size={16} />
                Rétablir : tous les pays
              </button>
            ) : null}
          </FormSection>
        ) : (
          <FormSection title="Valeur">
            <div className="flex items-stretch gap-2">
              <button
                type="button"
                onClick={() => nudge(-1)}
                aria-label="Diminuer"
                className="flex w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition hover:border-primary/40 hover:text-primary active:scale-95"
              >
                <IconMinus size={18} />
              </button>
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  inputMode="decimal"
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  aria-label="Valeur"
                  className="h-11 w-full rounded-xl border border-border bg-surface px-3.5 pr-16 text-center text-lg font-bold text-text-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {info.unit ? (
                  <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted">
                    {info.unit}
                  </span>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => nudge(1)}
                aria-label="Augmenter"
                className="flex w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-text-secondary transition hover:border-primary/40 hover:text-primary active:scale-95"
              >
                <IconPlus size={18} />
              </button>
            </div>
            {known.kind === 'money' ? (
              <p className="text-xs text-text-muted">Montant dans la monnaie du pays concerné, sans espace ni virgule.</p>
            ) : null}
            {defaultNumber !== null ? (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-text-secondary">Valeur par défaut : {formatKnownValue(known, defaultNumber)}</span>
                {differsFromDefault ? (
                  <button
                    type="button"
                    onClick={() => setRaw(String(defaultNumber))}
                    className="inline-flex items-center gap-1.5 font-semibold text-primary transition hover:text-primary-dark"
                  >
                    <IconArrowBackUp size={16} />
                    Rétablir
                  </button>
                ) : null}
              </div>
            ) : null}
          </FormSection>
        )}

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Modale d'un réglage avancé (ajout manuel ou réglage inconnu)
// ---------------------------------------------------------------------------

type CustomType = 'number' | 'text' | 'boolean' | 'json';

const CUSTOM_TYPE_OPTIONS: { value: CustomType; label: string }[] = [
  { value: 'number', label: 'Nombre' },
  { value: 'text', label: 'Texte' },
  { value: 'boolean', label: 'Oui / Non' },
  { value: 'json', label: 'Avancé' },
];

const KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

function customTypeOf(value: unknown): CustomType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'text';
  return 'json';
}

function customValueToEditor(value: unknown, type: CustomType): string {
  if (type === 'json') return JSON.stringify(value, null, 2) ?? '';
  if (type === 'boolean') return '';
  return value === null || value === undefined ? '' : String(value);
}

type ParsedValue = { ok: true; value: unknown } | { ok: false; error: string };

function buildCustomValue(type: CustomType, raw: string, flag: boolean): ParsedValue {
  if (type === 'boolean') return { ok: true, value: flag };
  if (type === 'number') {
    const parsed = parseNumber(raw);
    if (parsed === null) return { ok: false, error: 'Saisis un nombre valide, par exemple 25 ou 1,5.' };
    return { ok: true, value: parsed };
  }
  if (type === 'text') {
    if (!raw.trim()) return { ok: false, error: 'Saisis une valeur.' };
    return { ok: true, value: raw };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'Cette valeur avancée n’est pas valide. Vérifie les guillemets et les accolades.' };
  }
}

function CustomSettingModal({
  open,
  onClose,
  row,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  row: Row | null;
  onSaved: (message: string) => void;
}) {
  const upsert = useUpsertPlatformSetting();
  const remove = useRemovePlatformSetting();

  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<CustomType>('number');
  const [raw, setRaw] = useState('');
  const [flag, setFlag] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    if (row?.stored) {
      const initialType = customTypeOf(row.stored.value);
      setKey(row.stored.key);
      setDescription(row.stored.description ?? '');
      setType(initialType);
      setRaw(customValueToEditor(row.stored.value, initialType));
      setFlag(row.stored.value === true);
    } else {
      setKey('');
      setDescription('');
      setType('number');
      setRaw('');
      setFlag(false);
    }
    setConfirmingDelete(false);
    setErrorMessage(undefined);
  }, [open, row]);

  const editing = row?.stored ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    const trimmedKey = key.trim();
    if (!editing && !KEY_PATTERN.test(trimmedKey)) {
      setErrorMessage('Le nom technique doit suivre le format « domaine.parametre », en minuscules.');
      return;
    }

    const parsed = buildCustomValue(type, raw, flag);
    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return;
    }

    try {
      await upsert.mutateAsync({
        key: editing ? editing.key : trimmedKey,
        value: parsed.value,
        // En modification, une description vidée doit pouvoir s'effacer : on envoie la chaîne vide.
        description: editing ? description.trim() : description.trim() || undefined,
      });
      onSaved('Le réglage est enregistré.');
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    if (!editing) return;
    setErrorMessage(undefined);
    try {
      await remove.mutateAsync(editing.key);
      onSaved('Le réglage est supprimé.');
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDelete(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Modifier le réglage' : 'Nouveau réglage avancé'}
      description={
        editing
          ? undefined
          : 'Réservé aux réglages demandés par l’équipe technique : un réglage n’a d’effet que si la plateforme sait le lire.'
      }
      zIndex={60}
      footer={
        <>
          {editing ? (
            confirmingDelete ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-2xl bg-danger-light/40 px-4 py-3">
                <span className="text-sm font-medium text-danger-dark">
                  Supprimer ce réglage ? La plateforme peut le lire en direct : son comportement peut changer.
                </span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" loading={remove.isPending} onClick={handleDelete}>
                    Confirmer
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-light/40"
              >
                <IconTrash size={16} />
                Supprimer
              </button>
            )
          ) : null}
          {!confirmingDelete ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" form="custom-setting-form" loading={upsert.isPending}>
                {editing ? 'Enregistrer' : 'Ajouter le réglage'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <form id="custom-setting-form" onSubmit={handleSubmit} className="space-y-6">
        <FormSection title="Réglage">
          {editing ? null : (
            <TextField
              label="Nom technique"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="domaine.parametre"
              hint="En minuscules, avec un point entre le domaine et le paramètre."
            />
          )}
          <TextField
            label="Nom affiché (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rayon de recherche, en kilomètres"
            hint="Il sert de titre à la carte."
          />
        </FormSection>

        <FormSection title="Valeur" description="Choisis le type de la valeur, puis saisis-la.">
          <SegmentedControl value={type} onChange={setType} options={CUSTOM_TYPE_OPTIONS} ariaLabel="Type de la valeur" />
          {type === 'number' ? <TextField label="Nombre" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="25" /> : null}
          {type === 'text' ? <TextField label="Texte" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Une valeur" /> : null}
          {type === 'boolean' ? (
            <ToggleRow checked={flag} onChange={setFlag} label={flag ? 'Activé' : 'Désactivé'} description="Active ou désactive cette option." />
          ) : null}
          {type === 'json' ? <TextArea label="Valeur avancée" value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} /> : null}
        </FormSection>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type ModalState = { row: Row | null; custom: boolean } | null;

export default function PlatformSettingsPage() {
  const { data: settings, isLoading, isError } = usePlatformSettings();
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState<GroupId | ''>('');
  const [modal, setModal] = useState<ModalState>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const rows = useMemo(() => buildRows(settings ?? []), [settings]);

  // Le message de confirmation disparaît tout seul.
  useEffect(() => {
    if (!savedMessage) return;
    const timeout = setTimeout(() => setSavedMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [savedMessage]);

  const searched = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const groupTitle = GROUPS.find((group) => group.id === row.group)?.title ?? '';
      return [row.title, row.help, groupTitle].join(' ').toLowerCase().includes(query);
    });
  }, [rows, search]);

  const sections = useMemo(
    () =>
      GROUPS.map((group) => ({ ...group, items: searched.filter((row) => row.group === group.id) })).filter(
        (group) => group.items.length > 0,
      ),
    [searched],
  );

  const visibleSections = groupFilter ? sections.filter((section) => section.id === groupFilter) : sections;
  const groupOptions = sections.map((section) => ({ value: section.id, label: `${section.title} (${section.items.length})` }));

  const customizedCount = rows.filter((row) => row.known && row.stored && !row.isDefault).length;
  const themesCount = new Set(rows.map((row) => row.group)).size;
  const showExchangeCard = !search.trim() || 'taux de change devises'.includes(search.trim().toLowerCase());

  function openRow(row: Row) {
    setModal({ row, custom: row.known === null });
  }

  return (
    <div className="space-y-4">
      <PageHero
        eyebrow="Système"
        title="Paramètres"
        description="Les réglages appliqués en direct par la plateforme : délais, tarifs, retraits… Une modification s’applique tout de suite, sans redéploiement."
        stats={[
          { value: settings ? String(rows.length) : '…', label: rows.length > 1 ? 'réglages' : 'réglage' },
          { value: settings ? String(customizedCount) : '…', label: customizedCount > 1 ? 'personnalisés' : 'personnalisé' },
          { value: settings ? String(themesCount) : '…', label: themesCount > 1 ? 'thèmes' : 'thème' },
        ]}
      />

      <div className="flex items-center gap-2">
        <SearchField
          value={search}
          onChange={setSearch}
          placeholder="Rechercher un réglage…"
          ariaLabel="Rechercher un réglage"
          className="flex-1"
        />
        <Button type="button" variant="secondary" onClick={() => setModal({ row: null, custom: true })} className="h-11 shrink-0">
          <IconPlus size={16} />
          Avancé
        </Button>
      </div>

      {groupOptions.length > 1 ? (
        <FilterChips value={groupFilter} onChange={setGroupFilter} options={groupOptions} allLabel="Tous les thèmes" />
      ) : null}

      {savedMessage ? <SavedNotice>{savedMessage}</SavedNotice> : null}

      {isError ? (
        <Notice tone="danger">Impossible de charger les réglages. Cette section est réservée au SuperAdmin.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={6} heightClass="h-36" gridClass="sm:grid-cols-2 xl:grid-cols-3" />
      ) : visibleSections.length === 0 && !showExchangeCard ? (
        <EmptyState icon={<IconAdjustments size={26} />} title="Aucun réglage ne correspond" text="Essaie un autre mot-clé." />
      ) : (
        <div className="space-y-7">
          {visibleSections.map((section) => {
            const SectionIcon = section.icon;
            return (
              <section key={section.id} className="space-y-3">
                <div className="flex items-center gap-3">
                  <IconTile tone="primary">
                    <SectionIcon size={20} />
                  </IconTile>
                  <div className="min-w-0">
                    <h2 className="font-bold leading-tight text-text-primary">{section.title}</h2>
                    <p className="text-xs text-text-secondary">{section.description}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {section.items.map((row) => (
                    <SettingCard key={row.id} row={row} onClick={() => openRow(row)} />
                  ))}
                </div>
              </section>
            );
          })}

          {showExchangeCard && !groupFilter ? (
            <section className="space-y-3">
              <div className="flex items-center gap-3">
                <IconTile tone="accent">
                  <IconArrowsExchange size={20} />
                </IconTile>
                <div className="min-w-0">
                  <h2 className="font-bold leading-tight text-text-primary">Taux de change</h2>
                  <p className="text-xs text-text-secondary">Les taux entre les devises se règlent dans leur propre page.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <ListCard href="/exchange-rates" tone="accent">
                  <div className="flex items-center gap-3">
                    <IconTile tone="accent">
                      <IconArrowsExchange size={20} />
                    </IconTile>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-text-primary">Gérer les taux de change</p>
                      <p className="text-xs text-text-secondary">Ouvrir la page Taux de change</p>
                    </div>
                    <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
                  </div>
                </ListCard>
              </div>
            </section>
          ) : null}
        </div>
      )}

      <KnownSettingModal
        open={modal !== null && !modal.custom}
        onClose={() => setModal(null)}
        row={modal && !modal.custom ? modal.row : null}
        onSaved={setSavedMessage}
      />
      <CustomSettingModal
        open={modal !== null && modal.custom}
        onClose={() => setModal(null)}
        row={modal && modal.custom ? modal.row : null}
        onSaved={setSavedMessage}
      />
    </div>
  );
}