// web-admin/src/app/(app)/audit-logs/page.tsx
//
// v2 — Refonte complète, pensée pour se lire comme une histoire et non plus
// comme une liste de codes en vrac.
//   - Un guide « Comment lire ce journal ? » (Qui / Quoi / Sur quoi) ;
//   - les entrées sont regroupées par jour (Aujourd'hui, Hier, …) ;
//   - chaque entrée est une phrase : « thierno@… a modifié un moyen de
//     paiement », avec une icône par type d'action, l'élément concerné en
//     clair (« Moyen de paiement ») et son identifiant copiable ;
//   - « Détails » déplie ce qui a changé et l'adresse IP quand elles existent ;
//   - une action inconnue ne casse rien : elle s'affiche avec son code.
// Les libellés ci-dessous ne sont qu'une traduction d'affichage des codes
// écrits par le backend (AuditService.log) — pas des données.

'use client';

import React, { useMemo, useState } from 'react';
import {
  IconArrowsExchange,
  IconBan,
  IconCheck,
  IconChevronDown,
  IconCircleCheck,
  IconCopy,
  IconHistory,
  IconInfoCircle,
  IconLogin,
  IconPencil,
  IconPlayerPause,
  IconPlayerPlay,
  IconPlus,
  IconRobot,
  IconTrash,
} from '@tabler/icons-react';
import { Button } from '@/components/ui';
import { Chip, EmptyState, ListSkeleton, Notice, PageHero } from '@/components/admin/AdminUi';
import { useAuditLogs } from '@/hooks/useAuditLogs';

type AuditEntry = NonNullable<ReturnType<typeof useAuditLogs>['data']>['data'][number];
type Tone = 'primary' | 'success' | 'accent' | 'danger' | 'neutral';
type IconComponent = React.ComponentType<{ size?: number }>;

// ---------------------------------------------------------------------------
// Dictionnaires d'affichage
// ---------------------------------------------------------------------------

interface EntityNoun {
  label: string;
  /** « un moyen de paiement » — complément direct. */
  direct: string;
  /** « d'un moyen de paiement » — complément avec « de ». */
  of: string;
}

const ENTITY_NOUNS: Record<string, EntityNoun> = {
  User: { label: 'Utilisateur', direct: 'un compte utilisateur', of: 'd’un compte utilisateur' },
  PaymentProvider: { label: 'Moyen de paiement', direct: 'un moyen de paiement', of: 'd’un moyen de paiement' },
  Dispute: { label: 'Litige', direct: 'un litige', of: 'd’un litige' },
  Country: { label: 'Pays', direct: 'un pays', of: 'd’un pays' },
  City: { label: 'Ville', direct: 'une ville', of: 'd’une ville' },
  Currency: { label: 'Devise', direct: 'une devise', of: 'd’une devise' },
  Role: { label: 'Rôle', direct: 'un rôle', of: 'd’un rôle' },
  PlatformSetting: { label: 'Paramètre', direct: 'un paramètre de la plateforme', of: 'd’un paramètre de la plateforme' },
  Payout: { label: 'Retrait', direct: 'un retrait', of: 'd’un retrait' },
  ShipmentCategory: { label: 'Catégorie d’envoi', direct: 'une catégorie d’envoi', of: 'd’une catégorie d’envoi' },
  CommissionRule: { label: 'Commission', direct: 'une règle de commission', of: 'd’une règle de commission' },
  CancellationPolicy: { label: 'Annulation', direct: 'une politique d’annulation', of: 'd’une politique d’annulation' },
  NotificationTemplate: { label: 'Modèle de notification', direct: 'un modèle de notification', of: 'd’un modèle de notification' },
  Translation: { label: 'Traduction', direct: 'une traduction', of: 'd’une traduction' },
  Trip: { label: 'Trajet', direct: 'un trajet', of: 'd’un trajet' },
  Shipment: { label: 'Envoi', direct: 'un envoi', of: 'd’un envoi' },
  Booking: { label: 'Réservation', direct: 'une réservation', of: 'd’une réservation' },
  Vehicle: { label: 'Véhicule', direct: 'un véhicule', of: 'd’un véhicule' },
  DriverProfile: { label: 'Profil chauffeur', direct: 'un profil chauffeur', of: 'd’un profil chauffeur' },
  Wallet: { label: 'Portefeuille', direct: 'un portefeuille', of: 'd’un portefeuille' },
};

function nounFor(entityType: string): EntityNoun {
  return ENTITY_NOUNS[entityType] ?? {
    label: entityType,
    direct: `un élément « ${entityType} »`,
    of: `d’un élément « ${entityType} »`,
  };
}

function humanize(code: string): string {
  const text = code.replace(/[_-]+/g, ' ').toLowerCase().trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface ActionInfo {
  label: string;
  icon: IconComponent;
  tone: Tone;
  phrase: (noun: EntityNoun) => string;
  /** L'action porte sur le compte de l'acteur lui-même (connexion) : pas d'élément à afficher. */
  isSelf?: boolean;
}

const ACTIONS: Record<string, ActionInfo> = {
  LOGIN_OTP: { label: 'Connexion par code', icon: IconLogin, tone: 'neutral', phrase: () => 'a ouvert une session avec un code de vérification', isSelf: true },
  LOGIN_PASSWORD: { label: 'Connexion par mot de passe', icon: IconLogin, tone: 'neutral', phrase: () => 'a ouvert une session avec son mot de passe', isSelf: true },
  CREATE: { label: 'Création', icon: IconPlus, tone: 'success', phrase: (noun) => `a créé ${noun.direct}` },
  UPDATE: { label: 'Modification', icon: IconPencil, tone: 'primary', phrase: (noun) => `a modifié ${noun.direct}` },
  UPSERT: { label: 'Enregistrement', icon: IconPencil, tone: 'primary', phrase: (noun) => `a enregistré ${noun.direct}` },
  DELETE: { label: 'Suppression', icon: IconTrash, tone: 'danger', phrase: (noun) => `a supprimé ${noun.direct}` },
  ACTIVATE: { label: 'Activation', icon: IconPlayerPlay, tone: 'success', phrase: (noun) => `a activé ${noun.direct}` },
  DEACTIVATE: { label: 'Désactivation', icon: IconPlayerPause, tone: 'accent', phrase: (noun) => `a désactivé ${noun.direct}` },
  SUSPEND: { label: 'Suspension', icon: IconBan, tone: 'danger', phrase: (noun) => `a suspendu ${noun.direct}` },
  UNSUSPEND: { label: 'Réactivation', icon: IconCircleCheck, tone: 'success', phrase: (noun) => `a levé la suspension ${noun.of}` },
  STATUS_CHANGE: { label: 'Changement de statut', icon: IconArrowsExchange, tone: 'accent', phrase: (noun) => `a changé le statut ${noun.of}` },
};

function actionFor(action: string): ActionInfo {
  return (
    ACTIONS[action] ?? {
      label: humanize(action),
      icon: IconHistory,
      tone: 'neutral',
      phrase: (noun) => `a effectué l’action « ${humanize(action)} » sur ${noun.direct}`,
    }
  );
}

const TONE_TILE: Record<Tone, string> = {
  primary: 'bg-primary-light text-primary',
  success: 'bg-success-light text-success-dark',
  accent: 'bg-accent-light text-accent-dark',
  danger: 'bg-danger-light text-danger-dark',
  neutral: 'bg-border/40 text-text-secondary',
};

const DIFF_KEY_LABELS: Record<string, string> = {
  reason: 'Motif',
  email: 'Email',
  firstName: 'Prénom',
  lastName: 'Nom',
  key: 'Clé',
  value: 'Valeur',
  status: 'Statut',
  from: 'Avant',
  to: 'Après',
};

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const DAY_KEY_FORMAT = new Intl.DateTimeFormat('fr-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
const DAY_LABEL_FORMAT = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function dayHeading(date: Date, now: Date): { title: string; subtitle?: string } {
  const key = DAY_KEY_FORMAT.format(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (key === DAY_KEY_FORMAT.format(now)) return { title: 'Aujourd’hui', subtitle: capitalize(DAY_LABEL_FORMAT.format(date)) };
  if (key === DAY_KEY_FORMAT.format(yesterday)) return { title: 'Hier', subtitle: capitalize(DAY_LABEL_FORMAT.format(date)) };
  return { title: capitalize(DAY_LABEL_FORMAT.format(date)) };
}

interface DayGroup {
  key: string;
  title: string;
  subtitle?: string;
  entries: AuditEntry[];
}

function groupByDay(entries: AuditEntry[]): DayGroup[] {
  const now = new Date();
  const groups: DayGroup[] = [];
  for (const entry of entries) {
    const date = new Date(entry.createdAt);
    const key = DAY_KEY_FORMAT.format(date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      groups.push({ key, ...dayHeading(date, now), entries: [entry] });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Détails d'une entrée
// ---------------------------------------------------------------------------

/** Lit `diff` et `ipAddress` sans supposer qu'ils figurent dans le type de la liste. */
function readExtras(entry: object): { diff: [string, string][]; ipAddress: string | null } {
  const record = entry as Record<string, unknown>;
  const rawDiff = record.diff;
  const diff: [string, string][] =
    rawDiff && typeof rawDiff === 'object' && !Array.isArray(rawDiff)
      ? Object.entries(rawDiff as Record<string, unknown>).map(([key, value]) => [DIFF_KEY_LABELS[key] ?? key, formatDiffValue(value)])
      : [];
  const ipAddress = typeof record.ipAddress === 'string' && record.ipAddress ? record.ipAddress : null;
  return { diff, ipAddress };
}

function formatDiffValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

function CopyIdButton({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Presse-papiers indisponible : rien à faire, l'identifiant complet reste dans l'infobulle.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title={`Copier l’identifiant complet : ${id}`}
      className="inline-flex items-center gap-1 rounded-lg bg-border/30 px-2 py-1 font-mono text-[11px] text-text-secondary transition hover:bg-border/50"
    >
      {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
      {id.slice(0, 8)}…
    </button>
  );
}

function AuditEntryCard({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  const info = actionFor(entry.action);
  const noun = nounFor(entry.entityType);
  const Icon = info.icon;
  const actorName = entry.actor?.email ?? entry.actor?.phone ?? null;
  const { diff, ipAddress } = readExtras(entry);
  const hasDetails = diff.length > 0 || ipAddress !== null;

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-md">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${TONE_TILE[info.tone]}`}>
          {actorName ? <Icon size={20} /> : <IconRobot size={20} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-relaxed text-text-primary">
            <strong className="break-all font-semibold">{actorName ?? 'Le système'}</strong> {info.phrase(noun)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Chip tone={info.tone}>{info.label}</Chip>
            {info.isSelf ? null : (
              <>
                <Chip tone="neutral">{noun.label}</Chip>
                <CopyIdButton id={entry.entityId} />
              </>
            )}
          </div>
        </div>
        <time className="shrink-0 text-xs font-medium text-text-muted" dateTime={String(entry.createdAt)}>
          {TIME_FORMAT.format(new Date(entry.createdAt))}
        </time>
      </div>

      {hasDetails ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition hover:bg-primary-light/60"
          >
            {open ? 'Masquer les détails' : 'Voir les détails'}
            <IconChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
          {open ? (
            <dl className="mt-2 space-y-1.5 rounded-xl bg-primary-light/30 p-3 text-xs">
              {diff.map(([label, value]) => (
                <div key={label} className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-text-secondary">{label} :</dt>
                  <dd className="break-all font-mono text-text-primary">{value}</dd>
                </div>
              ))}
              {ipAddress ? (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-semibold text-text-secondary">Adresse IP :</dt>
                  <dd className="font-mono text-text-primary">{ipAddress}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guide de lecture
// ---------------------------------------------------------------------------

function HowToRead() {
  const [open, setOpen] = useState(true);

  const steps = [
    { title: 'Qui', text: 'La personne connectée qui a fait l’action — ou « Le système » quand elle vient d’un traitement automatique.' },
    { title: 'Quoi', text: 'Ce qui a été fait : une connexion, une modification, une activation, une suspension…' },
    { title: 'Sur quoi', text: 'L’élément concerné : un compte, un litige, un moyen de paiement… avec son identifiant, copiable.' },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-md">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-light text-primary">
            <IconInfoCircle size={18} />
          </span>
          Comment lire ce journal ?
        </span>
        <IconChevronDown size={18} className={`text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open ? (
        <div className="mt-4 space-y-4">
          <p className="text-sm text-text-secondary">
            Chaque ligne est la trace d’une action sensible faite sur la plateforme. Le journal sert à savoir qui a fait quoi, et
            quand, en cas de doute ou de litige. Il se consulte ici mais ne se modifie pas depuis l’interface.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step.title} className="rounded-xl bg-primary-light/40 p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-[#ffffff]">
                    {index + 1}
                  </span>
                  {step.title}
                </p>
                <p className="mt-1 text-xs text-text-secondary">{step.text}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const ENTITY_OPTIONS = Object.entries(ENTITY_NOUNS)
  .map(([value, noun]) => ({ value, label: noun.label }))
  .sort((a, b) => a.label.localeCompare(b.label));

export default function AuditLogsPage() {
  const [entityType, setEntityType] = useState('');
  const { data, isLoading, isError } = useAuditLogs({ entityType: entityType || undefined });

  const entries = data?.data ?? [];
  const total = data?.meta.total;
  const groups = useMemo(() => groupByDay(entries), [entries]);
  const isTruncated = total !== undefined && entries.length < total;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Système"
        title="Journal d’audit"
        description="La trace de toutes les actions sensibles faites sur la plateforme : qui a fait quoi, sur quel élément, et quand."
        stats={[{ value: total !== undefined ? String(total) : '…', label: entityType ? 'entrées pour ce type' : 'entrées au total' }]}
      />

      <HowToRead />

      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <select
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
            aria-label="Filtrer par type d’élément"
            className="w-full appearance-none rounded-xl border border-border bg-surface py-2.5 pl-3.5 pr-9 text-sm text-text-primary shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">Tous les types d’éléments</option>
            {ENTITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <IconChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
        </div>
        {entityType ? (
          <Button type="button" variant="ghost" onClick={() => setEntityType('')}>
            Effacer
          </Button>
        ) : null}
      </div>

      {isError ? (
        <Notice tone="danger">Impossible de charger le journal d’audit.</Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-24" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<IconHistory size={26} />}
          title="Aucune entrée"
          text={entityType ? 'Aucune action n’a été enregistrée pour ce type d’élément.' : 'Les actions sensibles apparaîtront ici dès qu’elles ont lieu.'}
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.key} className="space-y-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="text-base font-bold text-text-primary">{group.title}</h2>
                {group.subtitle ? <span className="text-sm text-text-secondary">{group.subtitle}</span> : null}
                <Chip tone="primary">
                  {group.entries.length} {group.entries.length > 1 ? 'actions' : 'action'}
                </Chip>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {group.entries.map((entry) => (
                  <AuditEntryCard key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          ))}
          {isTruncated ? (
            <p className="text-center text-xs text-text-muted">
              Affichage des {entries.length} actions les plus récentes sur {total}. Filtre par type d’élément pour cibler ce que tu cherches.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}