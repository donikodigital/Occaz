// web-admin/src/app/(app)/pricing/page.tsx
//
// v2 — Refonte complète.
//   - Deux onglets (Commissions, Annulations) au lieu de deux formulaires
//     permanents empilés au-dessus de deux tableaux ;
//   - chaque règle est une carte lisible : service, pays (avec drapeau et
//     non plus « Ce pays »), le taux ou le montant en grand ;
//   - l'ajout se fait dans une modale : commission en pourcentage OU en
//     montant fixe (un choix, un seul champ), remboursement réglé au
//     curseur, avec une phrase de résumé qui se met à jour ;
//   - désactiver demande une confirmation ; les erreurs de l'API s'affichent.

'use client';

import React, { useEffect, useState } from 'react';
import { IconCar, IconClockHour4, IconPackage, IconPercentage, IconPlus, IconReceiptRefund } from '@tabler/icons-react';
import { Badge, Button, Modal, Select, TextField } from '@/components/ui';
import {
  EmptyState,
  FormError,
  FormSection,
  ListSkeleton,
  Notice,
  PageHero,
  SegmentedControl,
  Tabs,
  isoToFlagEmoji,
} from '@/components/admin/AdminUi';
import {
  useCancellationPolicies,
  useCommissionRules,
  useCreateCancellationPolicy,
  useCreateCommissionRule,
  useDeactivateCancellationPolicy,
  useDeactivateCommissionRule,
} from '@/hooks/usePricing';
import { useCountries } from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';
import { formatMoney } from '@/utils/money';
import type { Country } from '@/types/geography.types';
import type { ServiceType } from '@/types/pricing.types';

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = { TRIP: 'Trajet', SHIPMENT: 'Envoi' };

const SERVICE_OPTIONS: { value: ServiceType; label: string; icon: React.ReactNode }[] = [
  { value: 'TRIP', label: 'Trajet', icon: <IconCar size={16} /> },
  { value: 'SHIPMENT', label: 'Envoi', icon: <IconPackage size={16} /> },
];

type CommissionRuleItem = NonNullable<ReturnType<typeof useCommissionRules>['data']>[number];
type CancellationPolicyItem = NonNullable<ReturnType<typeof useCancellationPolicies>['data']>[number];

function scopeLabel(countryId: string | null | undefined, countries: Country[]): string {
  if (!countryId) return 'Tous les pays';
  const country = countries.find((item) => item.id === countryId);
  return country ? `${isoToFlagEmoji(country.isoCode)} ${country.name}` : 'Un pays précis';
}

function ServiceTile({ serviceType }: { serviceType: ServiceType }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-primary">
      {serviceType === 'TRIP' ? <IconCar size={20} /> : <IconPackage size={20} />}
    </span>
  );
}

/** Désactivation en deux temps : on demande confirmation avant d'appeler l'API. */
function DeactivateControl({
  question,
  onConfirm,
  isPending,
  error,
}: {
  question: string;
  onConfirm: () => void;
  isPending: boolean;
  error: unknown;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-4">
      {confirming ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-danger-light/40 px-3 py-2.5">
          <span className="text-sm font-medium text-danger-dark">{question}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button variant="danger" loading={isPending} onClick={onConfirm}>
              Confirmer
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-light/40"
        >
          Désactiver
        </button>
      )}
      {error ? (
        <p className="mt-2 text-sm text-danger">{error instanceof ApiError ? error.message : 'Une erreur est survenue.'}</p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Commissions
// ---------------------------------------------------------------------------

function CommissionRuleCard({ rule, countries }: { rule: CommissionRuleItem; countries: Country[] }) {
  const deactivateRule = useDeactivateCommissionRule();
  const isPercentage = rule.percentage != null;

  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 shadow-sm ${rule.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <ServiceTile serviceType={rule.serviceType} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">{SERVICE_TYPE_LABELS[rule.serviceType]}</p>
          <p className="truncate text-xs text-text-secondary">{scopeLabel(rule.countryId, countries)}</p>
        </div>
        <Badge label={rule.isActive ? 'Actif' : 'Inactif'} tone={rule.isActive ? 'success' : 'neutral'} />
      </div>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="text-3xl font-bold text-text-primary">
          {isPercentage ? `${rule.percentage} %` : formatMoney(rule.fixedAmount ?? '0')}
        </span>
        <span className="text-sm text-text-secondary">{isPercentage ? 'de commission' : 'de commission fixe'}</span>
      </div>

      {rule.isActive ? (
        <DeactivateControl
          question="Désactiver cette règle ?"
          onConfirm={() => deactivateRule.mutate(rule.id)}
          isPending={deactivateRule.isPending}
          error={deactivateRule.error}
        />
      ) : null}
    </div>
  );
}

function CommissionRuleModal({ open, onClose, countries }: { open: boolean; onClose: () => void; countries: Country[] }) {
  const createRule = useCreateCommissionRule();

  const [serviceType, setServiceType] = useState<ServiceType>('TRIP');
  const [countryId, setCountryId] = useState('');
  const [mode, setMode] = useState<'percentage' | 'fixed'>('percentage');
  const [amount, setAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setServiceType('TRIP');
    setCountryId('');
    setMode('percentage');
    setAmount('');
    setErrorMessage(undefined);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    const value = amount.trim().replace(',', '.');
    if (!value) {
      setErrorMessage(mode === 'percentage' ? 'Indiquez le pourcentage.' : 'Indiquez le montant fixe.');
      return;
    }

    let commission: { percentage: number } | { fixedAmount: string };
    if (mode === 'percentage') {
      const percentage = Number(value);
      if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
        setErrorMessage('Le pourcentage doit être compris entre 0 et 100.');
        return;
      }
      commission = { percentage };
    } else {
      if (!/^\d+$/.test(value)) {
        setErrorMessage('Le montant fixe doit être un nombre entier, dans la plus petite unité de la devise.');
        return;
      }
      commission = { fixedAmount: value };
    }

    try {
      await createRule.mutateAsync({ serviceType, countryId: countryId || undefined, ...commission });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  const value = amount.trim().replace(',', '.');
  const noun = serviceType === 'TRIP' ? 'chaque trajet' : 'chaque envoi';
  const valueText = mode === 'percentage' ? `${value} %` : /^\d+$/.test(value) ? formatMoney(value) : value;
  const scope = countryId ? scopeLabel(countryId, countries) : 'tous les pays';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle commission"
      zIndex={60}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" form="commission-form" loading={createRule.isPending}>
            Ajouter la règle
          </Button>
        </>
      }
    >
      <form id="commission-form" onSubmit={handleSubmit} className="space-y-6">
        <FormSection title="Concerne">
          <SegmentedControl value={serviceType} onChange={setServiceType} options={SERVICE_OPTIONS} ariaLabel="Type de service" />
          <Select label="Pays (optionnel)" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">Tous les pays</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
        </FormSection>

        <FormSection title="Commission">
          <SegmentedControl
            value={mode}
            onChange={(next) => {
              setMode(next);
              setAmount('');
            }}
            options={[
              { value: 'percentage', label: 'Pourcentage', icon: <IconPercentage size={16} /> },
              { value: 'fixed', label: 'Montant fixe' },
            ]}
            ariaLabel="Type de commission"
          />
          <TextField
            label={mode === 'percentage' ? 'Pourcentage (%)' : 'Montant fixe'}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={mode === 'percentage' ? '15' : '5000'}
            hint={mode === 'fixed' ? 'Dans la plus petite unité de la devise (ex. 5000 pour 5 000 GNF).' : undefined}
          />
        </FormSection>

        {value ? (
          <p className="rounded-2xl bg-primary-light/50 px-4 py-3 text-sm text-text-primary">
            La plateforme prélève <strong>{valueText}</strong> sur {noun} — {scope}.
          </p>
        ) : null}

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

function CommissionRulesTab({ countries }: { countries: Country[] }) {
  const { data: rules, isLoading } = useCommissionRules();
  const [modalOpen, setModalOpen] = useState(false);

  const sorted = [...(rules ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Ce que la plateforme prélève sur chaque trajet ou envoi.</p>
        <Button type="button" onClick={() => setModalOpen(true)} className="shrink-0">
          <IconPlus size={16} />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton count={2} heightClass="h-36" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<IconPercentage size={26} />}
          title="Aucune règle de commission"
          text="Sans règle, la plateforme ne prélève rien. Ajoute un pourcentage ou un montant fixe."
          action={
            <Button type="button" onClick={() => setModalOpen(true)}>
              <IconPlus size={16} />
              Ajouter une commission
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((rule) => (
            <CommissionRuleCard key={rule.id} rule={rule} countries={countries} />
          ))}
        </div>
      )}

      <CommissionRuleModal open={modalOpen} onClose={() => setModalOpen(false)} countries={countries} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Politiques d'annulation
// ---------------------------------------------------------------------------

function CancellationPolicyCard({ policy, countries }: { policy: CancellationPolicyItem; countries: Country[] }) {
  const deactivatePolicy = useDeactivateCancellationPolicy();

  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 shadow-sm ${policy.isActive ? '' : 'opacity-70'}`}>
      <div className="flex items-start gap-3">
        <ServiceTile serviceType={policy.serviceType} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text-primary">{SERVICE_TYPE_LABELS[policy.serviceType]}</p>
          <p className="truncate text-xs text-text-secondary">{scopeLabel(policy.countryId, countries)}</p>
        </div>
        <Badge label={policy.isActive ? 'Actif' : 'Inactif'} tone={policy.isActive ? 'success' : 'neutral'} />
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
        <IconClockHour4 size={16} />
        <span>{policy.hoursBeforeDeparture} h avant le départ</span>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-text-secondary">Remboursé</span>
          <span className="text-2xl font-bold text-text-primary">{policy.refundPercentage} %</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-primary-light">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Math.max(policy.refundPercentage, 0), 100)}%` }} />
        </div>
      </div>

      {policy.isActive ? (
        <DeactivateControl
          question="Désactiver cette politique ?"
          onConfirm={() => deactivatePolicy.mutate(policy.id)}
          isPending={deactivatePolicy.isPending}
          error={deactivatePolicy.error}
        />
      ) : null}
    </div>
  );
}

function CancellationPolicyModal({ open, onClose, countries }: { open: boolean; onClose: () => void; countries: Country[] }) {
  const createPolicy = useCreateCancellationPolicy();

  const [serviceType, setServiceType] = useState<ServiceType>('TRIP');
  const [countryId, setCountryId] = useState('');
  const [hoursBeforeDeparture, setHoursBeforeDeparture] = useState('24');
  const [refundPercentage, setRefundPercentage] = useState(100);
  const [cancellationFee, setCancellationFee] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setServiceType('TRIP');
    setCountryId('');
    setHoursBeforeDeparture('24');
    setRefundPercentage(100);
    setCancellationFee('');
    setErrorMessage(undefined);
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    const hours = Number(hoursBeforeDeparture);
    if (!hoursBeforeDeparture.trim() || !Number.isFinite(hours) || hours < 0) {
      setErrorMessage('Indiquez un délai valide, en heures.');
      return;
    }
    const fee = cancellationFee.trim();
    if (fee && !/^\d+$/.test(fee)) {
      setErrorMessage('Les frais fixes doivent être un nombre entier, dans la plus petite unité de la devise.');
      return;
    }

    try {
      await createPolicy.mutateAsync({
        serviceType,
        countryId: countryId || undefined,
        hoursBeforeDeparture: hours,
        refundPercentage,
        cancellationFee: fee || undefined,
      });
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  const hoursText = hoursBeforeDeparture.trim() || '…';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nouvelle politique d’annulation"
      zIndex={60}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" form="policy-form" loading={createPolicy.isPending}>
            Ajouter la politique
          </Button>
        </>
      }
    >
      <form id="policy-form" onSubmit={handleSubmit} className="space-y-6">
        <FormSection title="Concerne">
          <SegmentedControl value={serviceType} onChange={setServiceType} options={SERVICE_OPTIONS} ariaLabel="Type de service" />
          <Select label="Pays (optionnel)" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">Tous les pays</option>
            {countries.map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
        </FormSection>

        <FormSection title="Délai" description="Combien d’heures avant le départ cette règle s’applique.">
          <TextField
            label="Délai (heures)"
            type="number"
            min={0}
            value={hoursBeforeDeparture}
            onChange={(e) => setHoursBeforeDeparture(e.target.value)}
          />
        </FormSection>

        <FormSection title="Remboursement">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-text-secondary">Part remboursée au client</span>
            <span className="text-2xl font-bold text-text-primary">{refundPercentage} %</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={refundPercentage}
            onChange={(e) => setRefundPercentage(Number(e.target.value))}
            aria-label="Pourcentage remboursé"
            className="w-full accent-primary"
          />
          <TextField
            label="Frais fixes (optionnel)"
            value={cancellationFee}
            onChange={(e) => setCancellationFee(e.target.value)}
            placeholder="0"
            hint="Dans la plus petite unité de la devise."
          />
        </FormSection>

        <p className="rounded-2xl bg-primary-light/50 px-4 py-3 text-sm text-text-primary">
          Annulation {hoursText} h avant le départ : le client est remboursé à <strong>{refundPercentage} %</strong>.
        </p>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

function CancellationPoliciesTab({ countries }: { countries: Country[] }) {
  const { data: policies, isLoading } = useCancellationPolicies();
  const [modalOpen, setModalOpen] = useState(false);

  const sorted = [...(policies ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Ce qui est remboursé au client selon le moment de l’annulation.</p>
        <Button type="button" onClick={() => setModalOpen(true)} className="shrink-0">
          <IconPlus size={16} />
          Ajouter
        </Button>
      </div>

      {isLoading ? (
        <ListSkeleton count={2} heightClass="h-44" />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<IconReceiptRefund size={26} />}
          title="Aucune politique d’annulation"
          text="Définis ce qui est remboursé selon le délai avant le départ."
          action={
            <Button type="button" onClick={() => setModalOpen(true)}>
              <IconPlus size={16} />
              Ajouter une politique
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {sorted.map((policy) => (
            <CancellationPolicyCard key={policy.id} policy={policy} countries={countries} />
          ))}
        </div>
      )}

      <CancellationPolicyModal open={modalOpen} onClose={() => setModalOpen(false)} countries={countries} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type PricingTab = 'commissions' | 'policies';

export default function PricingPage() {
  const { data: rules } = useCommissionRules();
  const { data: policies } = useCancellationPolicies();
  const { data: countries } = useCountries();

  const [tab, setTab] = useState<PricingTab>('commissions');

  const activeRules = (rules ?? []).filter((rule) => rule.isActive).length;
  const activePolicies = (policies ?? []).filter((policy) => policy.isActive).length;
  const countryList = countries ?? [];

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Finance"
        title="Tarification"
        description="Commissions prélevées par la plateforme et politiques de remboursement en cas d’annulation."
        stats={[
          { value: rules ? String(activeRules) : '…', label: activeRules > 1 ? 'commissions actives' : 'commission active' },
          { value: policies ? String(activePolicies) : '…', label: activePolicies > 1 ? 'politiques actives' : 'politique active' },
        ]}
      />

      {rules && activeRules === 0 ? (
        <Notice>Aucune commission active : la plateforme ne prélève rien pour l’instant.</Notice>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'commissions', label: 'Commissions', icon: <IconPercentage size={16} />, count: rules?.length },
          { value: 'policies', label: 'Annulations', icon: <IconReceiptRefund size={16} />, count: policies?.length },
        ]}
      />

      {tab === 'commissions' ? <CommissionRulesTab countries={countryList} /> : <CancellationPoliciesTab countries={countryList} />}
    </div>
  );
}