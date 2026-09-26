// web-admin/src/app/(app)/exchange-rates/page.tsx
//
// Écran dédié, séparé de la page « Paramètres plateforme » générique : les
// taux de change (exchange_rate.<from>_<to>) sont un cas assez particulier
// — une paire de devises, un sens, un nombre — pour mériter des cartes
// lisibles plutôt qu'un éditeur clé/valeur brut. Sous le capot, c'est
// exactement le même mécanisme (PlatformSetting), donc tout changement
// fait ici apparaît aussi dans Paramètres, et inversement.
//
// Une seule clé par paire est active à la fois : ExchangeRateService lit
// d'abord "exchange_rate.a_b", sinon l'inverse de "exchange_rate.b_a".
// Modifier le sens ici retire l'ancienne clé pour ne jamais en laisser
// deux contradictoires.

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { IconArrowsExchange, IconEdit, IconTrash } from '@tabler/icons-react';
import { Button, Modal, TextField } from '@/components/ui';
import {
  Chip,
  EmptyState,
  FormError,
  FormSection,
  LinkButton,
  ListSkeleton,
  Notice,
  PageHero,
  SegmentedControl,
} from '@/components/admin/AdminUi';
import { useCurrencies } from '@/hooks/useGeography';
import { usePlatformSettings, useRemovePlatformSetting, useUpsertPlatformSetting } from '@/hooks/usePlatformSettings';
import { ApiError } from '@/services/api/ApiError';
import type { Currency } from '@/types/geography.types';
import type { PlatformSetting } from '@/types/platformSettings.types';

type Direction = 'a_to_b' | 'b_to_a';

interface RatePair {
  a: Currency;
  b: Currency;
}

interface ResolvedRate {
  key: string;
  direction: Direction;
  value: number;
  updatedAt: string;
}

function rateKey(fromIso: string, toIso: string): string {
  return `exchange_rate.${fromIso.toLowerCase()}_${toIso.toLowerCase()}`;
}

function resolveRate(pair: RatePair, rateSettings: PlatformSetting[]): ResolvedRate | null {
  const directKey = rateKey(pair.a.isoCode, pair.b.isoCode);
  const inverseKey = rateKey(pair.b.isoCode, pair.a.isoCode);

  const direct = rateSettings.find((setting) => setting.key === directKey);
  if (direct && typeof direct.value === 'number') {
    return { key: directKey, direction: 'a_to_b', value: direct.value, updatedAt: direct.updatedAt };
  }

  const inverse = rateSettings.find((setting) => setting.key === inverseKey);
  if (inverse && typeof inverse.value === 'number') {
    return { key: inverseKey, direction: 'b_to_a', value: inverse.value, updatedAt: inverse.updatedAt };
  }

  return null;
}

function formatRate(value: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 6 }).format(value);
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

// ---------------------------------------------------------------------------
// Carte d'une paire de devises
// ---------------------------------------------------------------------------

function PairCard({ pair, resolved, onEdit }: { pair: RatePair; resolved: ResolvedRate | null; onEdit: () => void }) {
  const fromCurrency = resolved?.direction === 'b_to_a' ? pair.b : pair.a;
  const toCurrency = resolved?.direction === 'b_to_a' ? pair.a : pair.b;

  return (
    <button
      type="button"
      onClick={onEdit}
      className="group flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-4 text-left shadow-md transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Chip tone="primary">{pair.a.isoCode}</Chip>
          <IconArrowsExchange size={16} className="shrink-0 text-text-muted" />
          <Chip tone="primary">{pair.b.isoCode}</Chip>
        </div>
        <IconEdit size={16} className="shrink-0 text-text-muted transition-colors group-hover:text-primary" />
      </div>

      {resolved ? (
        <div>
          <p className="text-lg font-bold text-text-primary">
            1 {fromCurrency.isoCode} = {formatRate(resolved.value)} {toCurrency.isoCode}
          </p>
          <p className="text-xs text-text-secondary">
            soit environ 1 {toCurrency.isoCode} ≈ {formatRate(1 / resolved.value)} {fromCurrency.isoCode}
          </p>
          <p className="mt-2 text-[11px] text-text-muted">Mis à jour le {formatDate(resolved.updatedAt)}</p>
        </div>
      ) : (
        <p className="text-sm font-medium text-accent-dark">Aucun taux configuré</p>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Modale d'édition
// ---------------------------------------------------------------------------

function RateModal({
  open,
  onClose,
  pair,
  resolved,
}: {
  open: boolean;
  onClose: () => void;
  pair: RatePair | null;
  resolved: ResolvedRate | null;
}) {
  const upsert = useUpsertPlatformSetting();
  const remove = useRemovePlatformSetting();

  const [direction, setDirection] = useState<Direction>('a_to_b');
  const [raw, setRaw] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirection(resolved?.direction ?? 'a_to_b');
    setRaw(resolved ? String(resolved.value) : '');
    setErrorMessage(undefined);
    setConfirmingDelete(false);
  }, [open, resolved]);

  if (!pair) return null;

  const fromCurrency = direction === 'a_to_b' ? pair.a : pair.b;
  const toCurrency = direction === 'a_to_b' ? pair.b : pair.a;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    const parsed = Number(raw.trim().replace(',', '.'));
    if (!raw.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setErrorMessage('Saisis un taux valide, supérieur à 0 (ex. 0.0142 ou 70.4).');
      return;
    }

    const newKey = rateKey(fromCurrency.isoCode, toCurrency.isoCode);
    // Un sens différent de celui déjà enregistré : on retire l'ancienne clé
    // pour ne jamais laisser deux taux contradictoires actifs pour la même paire.
    const staleKey = resolved && resolved.key !== newKey ? resolved.key : null;

    try {
      await upsert.mutateAsync({
        key: newKey,
        value: parsed,
        description: `Taux de change ${fromCurrency.isoCode} → ${toCurrency.isoCode}`,
      });
      if (staleKey) await remove.mutateAsync(staleKey);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : "Impossible d'enregistrer ce taux.");
    }
  }

  async function handleDelete() {
    if (!resolved) return;
    setErrorMessage(undefined);
    try {
      await remove.mutateAsync(resolved.key);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Impossible de supprimer ce taux.');
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${pair.a.isoCode} ↔ ${pair.b.isoCode}`}
      description="Un seul sens à renseigner — l'autre se calcule automatiquement."
      footer={
        confirmingDelete ? (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-2xl bg-danger-light/40 px-4 py-3">
            <span className="text-sm font-medium text-danger-dark">
              Supprimer ce taux ? Toute conversion {pair.a.isoCode} ↔ {pair.b.isoCode} échouera explicitement tant
              qu&apos;aucun taux n&apos;est reconfiguré — jamais un repli silencieux sur 1:1.
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
          <>
            {resolved ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-light/40"
              >
                <IconTrash size={16} />
                Supprimer
              </button>
            ) : null}
            <Button variant="ghost" onClick={onClose}>
              Fermer
            </Button>
            <Button type="submit" form="rate-form" loading={upsert.isPending}>
              {resolved ? 'Enregistrer' : 'Configurer'}
            </Button>
          </>
        )
      }
    >
      <form id="rate-form" onSubmit={handleSubmit} className="space-y-5">
        <FormSection title="Sens du taux">
          <SegmentedControl
            value={direction}
            onChange={setDirection}
            ariaLabel="Sens du taux de change"
            options={[
              { value: 'a_to_b', label: `1 ${pair.a.isoCode} = ? ${pair.b.isoCode}` },
              { value: 'b_to_a', label: `1 ${pair.b.isoCode} = ? ${pair.a.isoCode}` },
            ]}
          />
        </FormSection>

        <FormSection title="Taux">
          <TextField
            label={`1 ${fromCurrency.isoCode} =`}
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={direction === 'a_to_b' ? '0.0142' : '70.4'}
            hint={`Combien de ${toCurrency.isoCode} pour 1 ${fromCurrency.isoCode}.`}
            inputMode="decimal"
          />
        </FormSection>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExchangeRatesPage() {
  const { data: currencies, isLoading: currenciesLoading, isError: currenciesError } = useCurrencies();
  const { data: settings, isLoading: settingsLoading, isError: settingsError } = usePlatformSettings();
  const [selectedPair, setSelectedPair] = useState<RatePair | null>(null);

  const rateSettings = useMemo(() => (settings ?? []).filter((setting) => setting.key.startsWith('exchange_rate.')), [settings]);

  const pairs = useMemo<RatePair[]>(() => {
    const sorted = [...(currencies ?? [])].sort((a, b) => a.isoCode.localeCompare(b.isoCode));
    const result: RatePair[] = [];
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        result.push({ a: sorted[i], b: sorted[j] });
      }
    }
    return result;
  }, [currencies]);

  const selectedResolved = selectedPair ? resolveRate(selectedPair, rateSettings) : null;
  const isLoading = currenciesLoading || settingsLoading;
  const isError = currenciesError || settingsError;
  const configuredCount = pairs.filter((pair) => resolveRate(pair, rateSettings) !== null).length;

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Taux de change"
        description="Convertit automatiquement le montant crédité à un chauffeur quand un trajet ou un envoi est payé dans une autre devise que son portefeuille — sans redéploiement. Renseigne un seul sens par paire, l'autre se calcule tout seul."
        stats={
          currencies
            ? [
                { value: String(pairs.length), label: pairs.length > 1 ? 'paires de devises' : 'paire de devises' },
                { value: String(configuredCount), label: configuredCount > 1 ? 'taux configurés' : 'taux configuré' },
              ]
            : undefined
        }
      />

      {isError ? (
        <Notice tone="danger">
          Impossible de charger les taux de change — cette section exige la permission SETTINGS_UPDATE (SuperAdmin).
        </Notice>
      ) : isLoading ? (
        <ListSkeleton count={2} heightClass="h-32" />
      ) : pairs.length === 0 ? (
        <EmptyState
          icon={<IconArrowsExchange size={26} />}
          title="Pas encore assez de devises"
          text="Il faut au moins deux devises pour configurer un taux de change entre elles."
          action={<LinkButton href="/geography">Aller à Géographie</LinkButton>}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {pairs.map((pair) => (
            <PairCard
              key={`${pair.a.id}_${pair.b.id}`}
              pair={pair}
              resolved={resolveRate(pair, rateSettings)}
              onEdit={() => setSelectedPair(pair)}
            />
          ))}
        </div>
      )}

      <RateModal open={selectedPair !== null} onClose={() => setSelectedPair(null)} pair={selectedPair} resolved={selectedResolved} />
    </div>
  );
}