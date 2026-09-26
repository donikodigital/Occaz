// web-admin/src/app/(app)/settings/page.tsx
//
// v2 — Refonte complète (réservée au SuperAdmin : SETTINGS_UPDATE n'est
// accordée à aucun des rôles Support du seed, voir rbac.seed.ts).
//   - Les réglages sont groupés par domaine (« trip.… » → Trajets), chacun
//     sur une carte : titre lisible (la description, sinon le nom du
//     paramètre), clé technique, et la valeur affichée selon son type
//     (nombre en grand, Oui/Non, texte, bloc JSON) ;
//   - ajout et modification en modale, avec un choix de type (Nombre,
//     Texte, Oui / Non, JSON) : plus besoin d'écrire du JSON à la main pour
//     une simple valeur ;
//   - la clé ne se modifie pas (elle identifie le paramètre) ; suppression
//     en deux temps avec un avertissement, car le backend lit ces valeurs
//     à l'exécution.

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IconAdjustments, IconChevronRight, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { Button, Modal, TextArea, TextField } from '@/components/ui';
import {
  Chip,
  EmptyState,
  FormError,
  FormSection,
  ListSkeleton,
  Notice,
  PageHero,
  SegmentedControl,
  ToggleRow,
} from '@/components/admin/AdminUi';
import { usePlatformSettings, useRemovePlatformSetting, useUpsertPlatformSetting } from '@/hooks/usePlatformSettings';
import { ApiError } from '@/services/api/ApiError';

type SettingItem = NonNullable<ReturnType<typeof usePlatformSettings>['data']>[number];
type ValueType = 'number' | 'text' | 'boolean' | 'json';

const KEY_PATTERN = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;

const VALUE_TYPE_OPTIONS: { value: ValueType; label: string }[] = [
  { value: 'number', label: 'Nombre' },
  { value: 'text', label: 'Texte' },
  { value: 'boolean', label: 'Oui / Non' },
  { value: 'json', label: 'JSON' },
];

const DOMAIN_LABELS: Record<string, string> = {
  trip: 'Trajets',
  shipment: 'Envois',
  exchange_rate: 'Taux de change',
};

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function humanize(code: string): string {
  return capitalize(code.replace(/[_-]+/g, ' ').toLowerCase().trim());
}

function domainOf(key: string): string {
  return key.split('.')[0] ?? key;
}

function paramOf(key: string): string {
  const [, ...rest] = key.split('.');
  return rest.join('.') || key;
}

function domainLabel(domain: string): string {
  return DOMAIN_LABELS[domain] ?? humanize(domain);
}

function typeOfValue(value: unknown): ValueType {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'string') return 'text';
  return 'json';
}

function valueToEditor(value: unknown, type: ValueType): string {
  if (type === 'json') return JSON.stringify(value, null, 2) ?? '';
  if (type === 'boolean') return '';
  return value === null || value === undefined ? '' : String(value);
}

type ParsedValue = { ok: true; value: unknown } | { ok: false; error: string };

function buildValue(type: ValueType, raw: string, flag: boolean): ParsedValue {
  if (type === 'boolean') return { ok: true, value: flag };
  if (type === 'number') {
    const parsed = Number(raw.trim().replace(',', '.'));
    if (!raw.trim() || !Number.isFinite(parsed)) return { ok: false, error: 'Saisis un nombre valide (ex. 25 ou 1.5).' };
    return { ok: true, value: parsed };
  }
  if (type === 'text') {
    if (!raw.trim()) return { ok: false, error: 'Saisis une valeur.' };
    return { ok: true, value: raw };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, error: 'Le JSON n’est pas valide (ex. {"a": 1} ou [1, 2]).' };
  }
}

function SettingValue({ value }: { value: unknown }) {
  if (typeof value === 'number') return <span className="text-3xl font-bold text-text-primary">{value}</span>;
  if (typeof value === 'boolean') return <Chip tone={value ? 'success' : 'neutral'}>{value ? 'Oui' : 'Non'}</Chip>;
  if (typeof value === 'string') return <span className="break-words text-base font-semibold text-text-primary">{value}</span>;
  return (
    <pre className="max-h-32 overflow-auto rounded-xl bg-primary-light/30 p-3 font-mono text-xs text-text-primary">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

// ---------------------------------------------------------------------------
// Carte
// ---------------------------------------------------------------------------

function SettingCard({ setting, onClick }: { setting: SettingItem; onClick: () => void }) {
  const title = setting.description?.trim() || humanize(paramOf(setting.key));
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-text-primary">{title}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-text-muted">{setting.key}</p>
        </div>
        <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <SettingValue value={setting.value} />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Modale d'ajout / modification
// ---------------------------------------------------------------------------

function SettingModal({ open, onClose, setting }: { open: boolean; onClose: () => void; setting: SettingItem | null }) {
  const upsert = useUpsertPlatformSetting();
  const remove = useRemovePlatformSetting();

  const [key, setKey] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<ValueType>('number');
  const [raw, setRaw] = useState('');
  const [flag, setFlag] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    if (setting) {
      const initialType = typeOfValue(setting.value);
      setKey(setting.key);
      setDescription(setting.description ?? '');
      setType(initialType);
      setRaw(valueToEditor(setting.value, initialType));
      setFlag(setting.value === true);
    } else {
      setKey('');
      setDescription('');
      setType('number');
      setRaw('');
      setFlag(false);
    }
    setConfirmingDelete(false);
    setErrorMessage(undefined);
  }, [open, setting]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    const trimmedKey = key.trim();
    if (!setting && !KEY_PATTERN.test(trimmedKey)) {
      setErrorMessage('La clé doit suivre le format « domaine.parametre » (ex. trip.search_radius_km).');
      return;
    }

    const parsed = buildValue(type, raw, flag);
    if (!parsed.ok) {
      setErrorMessage(parsed.error);
      return;
    }

    try {
      await upsert.mutateAsync({
        key: setting ? setting.key : trimmedKey,
        value: parsed.value,
        // En modification, une description vidée doit pouvoir s'effacer : on envoie la chaîne vide.
        description: setting ? description.trim() : description.trim() || undefined,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    if (!setting) return;
    setErrorMessage(undefined);
    try {
      await remove.mutateAsync(setting.key);
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
      title={setting ? 'Modifier le paramètre' : 'Ajouter un paramètre'}
      zIndex={60}
      footer={
        <>
          {setting ? (
            confirmingDelete ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-2xl bg-danger-light/40 px-4 py-3">
                <span className="text-sm font-medium text-danger-dark">
                  Supprimer ce paramètre ? Le backend le lit à l’exécution : son comportement peut changer.
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
              <Button type="submit" form="setting-form" loading={upsert.isPending}>
                {setting ? 'Enregistrer' : 'Ajouter le paramètre'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <form id="setting-form" onSubmit={handleSubmit} className="space-y-6">
        <FormSection title="Paramètre">
          {setting ? (
            <div className="rounded-2xl bg-primary-light/50 p-4">
              <p className="text-xs font-semibold text-text-secondary">Clé (elle identifie le paramètre, elle ne change pas)</p>
              <p className="mt-1 break-all font-mono text-sm text-text-primary">{setting.key}</p>
            </div>
          ) : (
            <TextField
              label="Clé"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="trip.search_radius_km"
              hint="Format « domaine.parametre », en minuscules, avec des tirets bas."
            />
          )}
          <TextField
            label="Description (optionnel)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rayon de recherche des trajets, en km"
            hint="Elle sert de titre à la carte."
          />
        </FormSection>

        <FormSection title="Valeur" description="Choisis le type de la valeur, puis saisis-la.">
          <SegmentedControl value={type} onChange={setType} options={VALUE_TYPE_OPTIONS} ariaLabel="Type de la valeur" />
          {type === 'number' ? (
            <TextField label="Nombre" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="25" />
          ) : null}
          {type === 'text' ? <TextField label="Texte" value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Une valeur" /> : null}
          {type === 'boolean' ? (
            <ToggleRow checked={flag} onChange={setFlag} label={flag ? 'Oui' : 'Non'} description="Active ou désactive cette option." />
          ) : null}
          {type === 'json' ? (
            <TextArea label="JSON" value={raw} onChange={(e) => setRaw(e.target.value)} rows={6} placeholder='{"a": 1}' />
          ) : null}
        </FormSection>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Un générique multi-lignes passé directement à useState<...> commençant par
// une accolade sur une nouvelle ligne fait planter le parseur SWC/Next.js en
// .tsx — d'où cet alias nommé sur une seule ligne.
type ModalState = { setting: SettingItem | null } | null;

export default function PlatformSettingsPage() {
  const { data: settings, isLoading, isError } = usePlatformSettings();
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<ModalState>(null);

  const all = settings ?? [];

  const groups = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = all.filter(
      (setting) =>
        !query ||
        setting.key.toLowerCase().includes(query) ||
        (setting.description ?? '').toLowerCase().includes(query),
    );
    const byDomain = new Map<string, SettingItem[]>();
    for (const setting of filtered) {
      const domain = domainOf(setting.key);
      byDomain.set(domain, [...(byDomain.get(domain) ?? []), setting]);
    }
    return [...byDomain.entries()]
      .map(([domain, items]) => ({ domain, items: [...items].sort((a, b) => a.key.localeCompare(b.key)) }))
      .sort((a, b) => domainLabel(a.domain).localeCompare(domainLabel(b.domain)));
  }, [all, search]);

  const domainsCount = new Set(all.map((setting) => domainOf(setting.key))).size;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Système"
        title="Paramètres plateforme"
        description="Les réglages que le backend lit à l’exécution : rayon de recherche, seuils, tarifs… Une valeur modifiée ici s’applique sans redéploiement."
        stats={[
          { value: settings ? String(all.length) : '…', label: all.length > 1 ? 'paramètres' : 'paramètre' },
          { value: settings ? String(domainsCount) : '…', label: domainsCount > 1 ? 'domaines' : 'domaine' },
        ]}
      />

      <div className="flex items-center gap-2">
        {all.length > 6 ? (
          <div className="relative min-w-0 flex-1">
            <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher un paramètre…"
              aria-label="Rechercher un paramètre"
              className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        ) : (
          <div className="flex-1" />
        )}
        <Button type="button" onClick={() => setModal({ setting: null })} className="shrink-0">
          <IconPlus size={16} />
          Ajouter
        </Button>
      </div>

      {isError ? (
        <Notice tone="danger">
          Impossible de charger les paramètres — cette section exige la permission SETTINGS_UPDATE (SuperAdmin).
        </Notice>
      ) : isLoading ? (
        <ListSkeleton count={4} heightClass="h-28" />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<IconAdjustments size={26} />}
          title={search.trim() ? 'Aucun paramètre ne correspond' : 'Aucun paramètre'}
          text={
            search.trim()
              ? 'Essaie un autre mot-clé.'
              : 'Ajoute un réglage lu par le backend, par exemple le rayon de recherche des trajets (trip.search_radius_km).'
          }
          action={
            search.trim() ? undefined : (
              <Button type="button" onClick={() => setModal({ setting: null })}>
                <IconPlus size={16} />
                Ajouter un paramètre
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <section key={group.domain} className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-text-primary">{domainLabel(group.domain)}</h2>
                <Chip tone="primary">{group.items.length}</Chip>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {group.items.map((setting) => (
                  <SettingCard key={setting.key} setting={setting} onClick={() => setModal({ setting })} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SettingModal open={modal !== null} onClose={() => setModal(null)} setting={modal?.setting ?? null} />
    </div>
  );
}