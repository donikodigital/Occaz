// web-admin/src/app/(app)/trip-pricing/page.tsx
//
// « Configuration frais trajets » : le SuperAdmin reprend la main sur les prix fixés par les conducteurs.
//   - Le MODE (manuel, semi-automatique, automatique) vaut pour toute la plateforme.
//   - Les PALIERS (prix du kilomètre selon la distance) se règlent devise par devise : GNF, XOF…
//
// Les paliers sont progressifs : chaque tranche de kilomètres est facturée à son propre tarif (les 10 premiers km à 1 000,
// les 20 suivants à 700…). Un trajet plus long ne coûte donc jamais moins cher qu'un trajet plus court.
// Ce prix est celui que touche le conducteur : la commission Occa'Z s'ajoute ensuite pour le client, comme avant.
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAdjustmentsHorizontal,
  IconCoin,
  IconLock,
  IconPencil,
  IconPlus,
  IconRoute,
  IconTrash,
} from '@tabler/icons-react';
import { Button, TextField } from '@/components/ui';
import {
  CardShell,
  Chip,
  EmptyState,
  FormError,
  ListSkeleton,
  Notice,
  PageHero,
  SavedNotice,
  SectionCard,
  SegmentedControl,
  Tabs,
} from '@/components/admin/AdminUi';
import { useSaveTripPricing, useTripPricingConfig } from '@/hooks/useTripPricing';
import { ApiError } from '@/services/api/ApiError';
import type { PricingMode, SaveTripPricingPayload, TripPricingConfig } from '@/types/tripPricing.types';
import { formatMoney } from '@/utils/money';
import {
  MAX_TIERS,
  computeBounds,
  configFromDraft,
  defaultDraft,
  draftFromConfig,
  type PricingDraft,
} from '@/utils/tripPricing';

const MODE_LABELS: Record<PricingMode, string> = {
  MANUAL: 'Manuel',
  SEMI_AUTO: 'Semi-automatique',
  AUTO: 'Automatique',
};

const MODE_DETAILS: Record<PricingMode, { title: string; text: string; bullets: string[] }> = {
  MANUAL: {
    title: 'Le conducteur fixe librement son prix',
    text: "C'est le fonctionnement historique : aucun contrôle, aucun prix conseillé.",
    bullets: ["Le conducteur saisit n'importe quel prix par place.", 'Les paliers ci-dessous ne servent pas tant que ce mode est actif.'],
  },
  SEMI_AUTO: {
    title: 'Occa’Z conseille et plafonne',
    text: 'Pour chaque trajet, le système calcule un prix conseillé à partir de la distance, entre un minimum et un maximum.',
    bullets: [
      'Le conducteur voit le prix conseillé et peut l’ajuster.',
      'Un prix au-dessus du maximum est refusé immédiatement.',
      'Un prix en dessous du minimum reste accepté : le minimum n’est qu’un repère.',
    ],
  },
  AUTO: {
    title: 'Occa’Z fixe le prix, le conducteur ne peut rien changer',
    text: 'Le prix de chaque trajet est calculé par la plateforme à partir de la distance.',
    bullets: [
      'Le conducteur ne saisit plus de prix : il voit le prix fixé.',
      'Les prix des étapes intermédiaires sont calculés au prorata, non modifiables.',
      'Un brouillon est remis au prix du jour au moment de sa publication.',
    ],
  },
};

const PREVIEW_DISTANCES = [5, 20, 50, 100, 200, 400];

type Drafts = Record<string, PricingDraft | null>;

function buildDrafts(config: TripPricingConfig): Drafts {
  const drafts: Drafts = {};
  for (const currency of config.currencies) {
    drafts[currency.isoCode] = currency.config ? draftFromConfig(currency.config) : null;
  }
  return drafts;
}

function formatKm(value: string): string {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) ? new Intl.NumberFormat('fr-FR').format(parsed) : '…';
}

// ---------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------

function ModeSection({
  mode,
  onChange,
  unconfigured,
}: {
  mode: PricingMode;
  onChange: (mode: PricingMode) => void;
  unconfigured: string[];
}) {
  const detail = MODE_DETAILS[mode];
  return (
    <SectionCard
      title="Mode de fixation des prix"
      description="Valable pour toute la plateforme. Il s'applique aux nouveaux trajets dès l'enregistrement ; les trajets déjà publiés ne changent pas."
    >
      <SegmentedControl
        ariaLabel="Mode de fixation des prix"
        value={mode}
        onChange={onChange}
        options={[
          { value: 'MANUAL', label: MODE_LABELS.MANUAL, icon: <IconPencil size={16} /> },
          { value: 'SEMI_AUTO', label: MODE_LABELS.SEMI_AUTO, icon: <IconAdjustmentsHorizontal size={16} /> },
          { value: 'AUTO', label: MODE_LABELS.AUTO, icon: <IconLock size={16} /> },
        ]}
      />
      <div className="rounded-2xl bg-primary-light/50 p-4">
        <p className="text-sm font-semibold text-text-primary">{detail.title}</p>
        <p className="mt-1 text-xs text-text-secondary">{detail.text}</p>
        <ul className="mt-3 space-y-1.5">
          {detail.bullets.map((bullet) => (
            <li key={bullet} className="flex gap-2 text-xs text-text-secondary">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              <span>{bullet}</span>
            </li>
          ))}
        </ul>
      </div>
      {mode !== 'MANUAL' && unconfigured.length > 0 ? (
        <Notice>
          Pas encore de paliers pour {unconfigured.join(', ')} : les conducteurs de {unconfigured.length > 1 ? 'ces devises fixent' : 'cette devise fixent'}{' '}
          encore librement leur prix, même en mode {MODE_LABELS[mode].toLowerCase()}.
        </Notice>
      ) : null}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Paliers d'une devise
// ---------------------------------------------------------------------------

function TiersSection({
  isoCode,
  draft,
  onChange,
}: {
  isoCode: string;
  draft: PricingDraft;
  onChange: (draft: PricingDraft) => void;
}) {
  const lastIndex = draft.tiers.length - 1;

  function updateTier(index: number, patch: Partial<PricingDraft['tiers'][number]>) {
    onChange({ ...draft, tiers: draft.tiers.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)) });
  }

  function addTier() {
    if (draft.tiers.length >= MAX_TIERS) return;
    // Nouveau palier inséré avant le palier « au-delà », 20 km plus loin que le précédent.
    const previous = draft.tiers[lastIndex - 1];
    const previousEnd = previous ? Number(previous.upToKm.replace(',', '.')) : 0;
    const end = Number.isFinite(previousEnd) ? previousEnd + 20 : 20;
    const tiers = [...draft.tiers];
    tiers.splice(lastIndex, 0, { upToKm: String(end), pricePerKm: draft.tiers[lastIndex].pricePerKm });
    onChange({ ...draft, tiers });
  }

  function removeTier(index: number) {
    if (draft.tiers.length <= 1) return;
    const tiers = draft.tiers.filter((_, i) => i !== index);
    // Le dernier palier n'a jamais de limite.
    tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], upToKm: '' };
    onChange({ ...draft, tiers });
  }

  return (
    <SectionCard
      title="Prix du kilomètre par palier"
      description={`Chaque tranche de kilomètres est facturée à son propre tarif, en ${isoCode} par kilomètre.`}
    >
      <div className="space-y-3">
        {draft.tiers.map((tier, index) => {
          const isLast = index === lastIndex;
          const start = index === 0 ? '0' : draft.tiers[index - 1].upToKm || '…';
          return (
            <CardShell key={index} tone={isLast ? 'accent' : 'primary'} className="p-4 pl-5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip tone={isLast ? 'accent' : 'primary'}>Palier {index + 1}</Chip>
                  <span className="text-sm font-semibold text-text-primary">
                    {isLast ? `Au-delà de ${formatKm(start)} km` : `De ${formatKm(start)} à ${tier.upToKm ? formatKm(tier.upToKm) : '…'} km`}
                  </span>
                </div>
                {draft.tiers.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeTier(index)}
                    aria-label={`Supprimer le palier ${index + 1}`}
                    className="rounded-lg p-2 text-text-muted transition hover:bg-danger-light/40 hover:text-danger"
                  >
                    <IconTrash size={16} />
                  </button>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {isLast ? (
                  <div className="flex items-end rounded-lg bg-surface-muted px-3.5 py-2.5 text-sm text-text-secondary">
                    Sans limite de distance
                  </div>
                ) : (
                  <TextField
                    label="Jusqu'à (km)"
                    inputMode="decimal"
                    value={tier.upToKm}
                    onChange={(event) => updateTier(index, { upToKm: event.target.value })}
                  />
                )}
                <TextField
                  label={`Prix du km (${isoCode})`}
                  inputMode="numeric"
                  value={tier.pricePerKm}
                  onChange={(event) => updateTier(index, { pricePerKm: event.target.value })}
                />
              </div>
            </CardShell>
          );
        })}
      </div>
      {draft.tiers.length < MAX_TIERS ? (
        <Button variant="outline" onClick={addTier} className="w-full sm:w-auto">
          <IconPlus size={16} />
          Ajouter un palier
        </Button>
      ) : null}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Marge laissée aux conducteurs
// ---------------------------------------------------------------------------

function MarginSection({ isoCode, draft, onChange }: { isoCode: string; draft: PricingDraft; onChange: (draft: PricingDraft) => void }) {
  return (
    <SectionCard
      title="Marge laissée aux conducteurs"
      description="Autour du prix conseillé, utilisée en mode semi-automatique."
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <TextField
          label="Minimum conseillé (%)"
          inputMode="decimal"
          value={draft.minPercent}
          onChange={(event) => onChange({ ...draft, minPercent: event.target.value })}
          hint="Un repère : un prix plus bas reste accepté."
        />
        <TextField
          label="Maximum autorisé (%)"
          inputMode="decimal"
          value={draft.maxPercent}
          onChange={(event) => onChange({ ...draft, maxPercent: event.target.value })}
          hint="Un prix plus haut est refusé."
        />
        <TextField
          label={`Arrondi (${isoCode})`}
          inputMode="numeric"
          value={draft.roundingStep}
          onChange={(event) => onChange({ ...draft, roundingStep: event.target.value })}
          hint="Les prix sont arrondis à ce multiple."
        />
      </div>
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Aperçu en direct
// ---------------------------------------------------------------------------

function PreviewSection({ isoCode, draft, mode }: { isoCode: string; draft: PricingDraft; mode: PricingMode }) {
  const parsed = useMemo(() => configFromDraft(draft), [draft]);

  return (
    <SectionCard title="Aperçu" description="Ce que les conducteurs verraient avec ces réglages, pour quelques distances de route.">
      {parsed.ok ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PREVIEW_DISTANCES.map((distance) => {
            const bounds = computeBounds(distance, parsed.value);
            return (
              <CardShell key={distance} tone="success" className="p-4 pl-5">
                <div className="flex items-center gap-2">
                  <IconRoute size={16} className="text-text-muted" />
                  <span className="text-sm font-semibold text-text-primary">{distance} km</span>
                </div>
                <p className="mt-2 text-lg font-bold text-text-primary">{formatMoney(bounds.suggested, isoCode)}</p>
                <p className="text-[11px] text-text-muted">{mode === 'AUTO' ? 'prix fixé par place' : 'prix conseillé par place'}</p>
                {mode === 'SEMI_AUTO' ? (
                  <p className="mt-2 text-xs text-text-secondary">
                    de {formatMoney(bounds.min, '')} à {formatMoney(bounds.max, isoCode)}
                  </p>
                ) : null}
              </CardShell>
            );
          })}
        </div>
      ) : (
        <Notice>{parsed.error}</Notice>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TripPricingPage() {
  const { data, isLoading, isError } = useTripPricingConfig();
  const save = useSaveTripPricing();

  const [mode, setMode] = useState<PricingMode>('MANUAL');
  const [drafts, setDrafts] = useState<Drafts>({});
  const [selectedIso, setSelectedIso] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [saved, setSaved] = useState(false);

  // (Re)charge la saisie depuis le serveur : au premier affichage et après chaque enregistrement.
  useEffect(() => {
    if (!data) return;
    setMode(data.mode);
    setDrafts(buildDrafts(data));
    setSelectedIso((current) => current ?? data.currencies[0]?.isoCode ?? null);
  }, [data]);

  const baseline = useMemo(() => (data ? JSON.stringify({ mode: data.mode, drafts: buildDrafts(data) }) : ''), [data]);
  const isDirty = data ? JSON.stringify({ mode, drafts }) !== baseline : false;

  const currencies = data?.currencies ?? [];
  const unconfigured = currencies.filter((currency) => !drafts[currency.isoCode]).map((currency) => currency.isoCode);
  const configuredCount = currencies.length - unconfigured.length;
  const selectedCurrency = currencies.find((currency) => currency.isoCode === selectedIso) ?? null;
  const selectedDraft = selectedCurrency ? (drafts[selectedCurrency.isoCode] ?? null) : null;

  function setDraft(isoCode: string, draft: PricingDraft | null) {
    setSaved(false);
    setDrafts((current) => ({ ...current, [isoCode]: draft }));
  }

  async function handleSave() {
    setErrorMessage(undefined);
    setSaved(false);

    const payload: SaveTripPricingPayload = { mode, currencies: {} };
    for (const currency of currencies) {
      const draft = drafts[currency.isoCode];
      if (!draft) {
        payload.currencies[currency.isoCode] = null;
        continue;
      }
      const parsed = configFromDraft(draft);
      if (!parsed.ok) {
        setSelectedIso(currency.isoCode);
        setErrorMessage(`${currency.isoCode} : ${parsed.error}`);
        return;
      }
      payload.currencies[currency.isoCode] = parsed.value;
    }

    try {
      await save.mutateAsync(payload);
      setSaved(true);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Impossible d'enregistrer la configuration.");
    }
  }

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Configuration frais trajets"
        description="Définis le prix du kilomètre par palier de distance et décide jusqu'où les conducteurs peuvent fixer leur prix : librement, dans une fourchette, ou pas du tout."
        stats={
          data
            ? [
                { value: MODE_LABELS[mode], label: 'mode actif' },
                { value: String(configuredCount), label: configuredCount > 1 ? 'devises configurées' : 'devise configurée' },
              ]
            : undefined
        }
      />

      {isError ? (
        <Notice tone="danger">
          Impossible de charger la configuration — cette section exige la permission SETTINGS_UPDATE (SuperAdmin).
        </Notice>
      ) : isLoading ? (
        <ListSkeleton count={3} heightClass="h-40" gridClass="grid-cols-1" />
      ) : (
        <>
          <ModeSection
            mode={mode}
            onChange={(next) => {
              setSaved(false);
              setMode(next);
            }}
            unconfigured={unconfigured}
          />

          {currencies.length === 0 ? (
            <EmptyState
              icon={<IconCoin size={26} />}
              title="Aucune devise"
              text="Ajoute d'abord une devise dans Géographie pour configurer ses paliers."
            />
          ) : (
            <>
              {currencies.length > 1 ? (
                <Tabs
                  value={selectedIso ?? currencies[0].isoCode}
                  onChange={setSelectedIso}
                  items={currencies.map((currency) => ({
                    value: currency.isoCode,
                    label: currency.isoCode,
                    icon: <IconCoin size={16} />,
                  }))}
                />
              ) : null}

              {selectedCurrency && selectedDraft ? (
                <>
                  <TiersSection
                    isoCode={selectedCurrency.isoCode}
                    draft={selectedDraft}
                    onChange={(draft) => setDraft(selectedCurrency.isoCode, draft)}
                  />
                  <MarginSection
                    isoCode={selectedCurrency.isoCode}
                    draft={selectedDraft}
                    onChange={(draft) => setDraft(selectedCurrency.isoCode, draft)}
                  />
                  <PreviewSection isoCode={selectedCurrency.isoCode} draft={selectedDraft} mode={mode} />
                  <button
                    type="button"
                    onClick={() => setDraft(selectedCurrency.isoCode, null)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-light/40"
                  >
                    <IconTrash size={16} />
                    Retirer la configuration {selectedCurrency.isoCode} (retour au prix libre)
                  </button>
                </>
              ) : selectedCurrency ? (
                <EmptyState
                  icon={<IconCoin size={26} />}
                  title={`${selectedCurrency.name} : pas encore de paliers`}
                  text={`Tant que ${selectedCurrency.isoCode} n'est pas configurée, les conducteurs de cette devise fixent librement leur prix, quel que soit le mode.`}
                  action={
                    <Button onClick={() => setDraft(selectedCurrency.isoCode, defaultDraft(selectedCurrency.isoCode))}>
                      <IconPlus size={16} />
                      Configurer {selectedCurrency.isoCode}
                    </Button>
                  }
                />
              ) : null}
            </>
          )}

          <div className="space-y-3 rounded-2xl border border-border bg-surface p-4 shadow-md sm:p-5">
            <FormError message={errorMessage} />
            {saved ? <SavedNotice>Configuration enregistrée. Elle s&apos;applique aux nouveaux trajets.</SavedNotice> : null}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-text-secondary">
                {isDirty ? 'Modifications non enregistrées.' : 'Aucune modification en attente.'} Le prix défini ici est celui du conducteur : la
                commission Occa&apos;Z s&apos;ajoute ensuite pour le client.
              </p>
              <Button onClick={handleSave} loading={save.isPending} disabled={!isDirty}>
                Enregistrer
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
