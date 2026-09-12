// web-admin/src/app/(app)/pricing/page.tsx
'use client';

import React, { useState } from 'react';
import { Badge, Button, Card, Select, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow, TextField } from '@/components/ui';
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
import type { ServiceType } from '@/types/pricing.types';

const SERVICE_TYPE_LABELS: Record<ServiceType, string> = { TRIP: 'Trajet', SHIPMENT: 'Envoi' };

function CommissionRulesSection() {
  const { data: rules, isLoading } = useCommissionRules();
  const { data: countries } = useCountries();
  const createRule = useCreateCommissionRule();
  const deactivateRule = useDeactivateCommissionRule();

  const [serviceType, setServiceType] = useState<ServiceType>('TRIP');
  const [countryId, setCountryId] = useState('');
  const [percentage, setPercentage] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (!percentage.trim() && !fixedAmount.trim()) {
      setErrorMessage('Indiquez un pourcentage ou un montant fixe.');
      return;
    }

    try {
      await createRule.mutateAsync({
        serviceType,
        countryId: countryId || undefined,
        percentage: percentage.trim() ? Number(percentage) : undefined,
        fixedAmount: fixedAmount.trim() || undefined,
      });
      setPercentage('');
      setFixedAmount('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Commissions</h2>
      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Select label="Service" value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>
            {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Pays (optionnel)" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">Tous pays</option>
            {(countries ?? []).map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
          <TextField label="Pourcentage" value={percentage} onChange={(e) => setPercentage(e.target.value)} placeholder="15" />
          <TextField
            label="Ou montant fixe"
            value={fixedAmount}
            onChange={(e) => setFixedAmount(e.target.value)}
            placeholder="Plus petite unité"
          />
          <div className="col-span-2 sm:col-span-4">
            {errorMessage ? <p className="mb-2 text-sm text-danger">{errorMessage}</p> : null}
            <Button type="submit" loading={createRule.isPending}>
              Ajouter la règle
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Service</TableHeaderCell>
              <TableHeaderCell>Portée</TableHeaderCell>
              <TableHeaderCell>Taux</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(rules ?? []).map((rule) => (
              <TableRow key={rule.id} className="hover:bg-surface-muted/50">
                <TableCell>{SERVICE_TYPE_LABELS[rule.serviceType]}</TableCell>
                <TableCell className="text-text-secondary">{rule.countryId ? 'Ce pays' : 'Tous pays'}</TableCell>
                <TableCell className="text-text-secondary">
                  {rule.percentage !== null ? `${rule.percentage}%` : formatMoney(rule.fixedAmount ?? '0')}
                </TableCell>
                <TableCell>
                  <Badge label={rule.isActive ? 'Actif' : 'Inactif'} tone={rule.isActive ? 'success' : 'neutral'} />
                </TableCell>
                <TableCell>
                  {rule.isActive ? (
                    <button
                      onClick={() => deactivateRule.mutate(rule.id)}
                      className="text-xs text-danger hover:underline"
                    >
                      Désactiver
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

function CancellationPoliciesSection() {
  const { data: policies, isLoading } = useCancellationPolicies();
  const { data: countries } = useCountries();
  const createPolicy = useCreateCancellationPolicy();
  const deactivatePolicy = useDeactivateCancellationPolicy();

  const [serviceType, setServiceType] = useState<ServiceType>('TRIP');
  const [countryId, setCountryId] = useState('');
  const [hoursBeforeDeparture, setHoursBeforeDeparture] = useState('24');
  const [refundPercentage, setRefundPercentage] = useState('100');
  const [cancellationFee, setCancellationFee] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    const hours = Number(hoursBeforeDeparture);
    const refund = Number(refundPercentage);
    if (!Number.isFinite(hours) || hours < 0 || !Number.isFinite(refund) || refund < 0 || refund > 100) {
      setErrorMessage('Vérifiez le délai (heures) et le pourcentage remboursé (0-100).');
      return;
    }

    try {
      await createPolicy.mutateAsync({
        serviceType,
        countryId: countryId || undefined,
        hoursBeforeDeparture: hours,
        refundPercentage: refund,
        cancellationFee: cancellationFee.trim() || undefined,
      });
      setCancellationFee('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Politiques d&apos;annulation</h2>
      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Select label="Service" value={serviceType} onChange={(e) => setServiceType(e.target.value as ServiceType)}>
            {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
          <Select label="Pays (optionnel)" value={countryId} onChange={(e) => setCountryId(e.target.value)}>
            <option value="">Tous pays</option>
            {(countries ?? []).map((country) => (
              <option key={country.id} value={country.id}>
                {country.name}
              </option>
            ))}
          </Select>
          <TextField
            label="Délai (heures)"
            value={hoursBeforeDeparture}
            onChange={(e) => setHoursBeforeDeparture(e.target.value)}
          />
          <TextField
            label="Remboursé (%)"
            value={refundPercentage}
            onChange={(e) => setRefundPercentage(e.target.value)}
          />
          <TextField
            label="Frais fixe (optionnel)"
            value={cancellationFee}
            onChange={(e) => setCancellationFee(e.target.value)}
          />
          <div className="col-span-2 sm:col-span-5">
            {errorMessage ? <p className="mb-2 text-sm text-danger">{errorMessage}</p> : null}
            <Button type="submit" loading={createPolicy.isPending}>
              Ajouter la politique
            </Button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Service</TableHeaderCell>
              <TableHeaderCell>Portée</TableHeaderCell>
              <TableHeaderCell>Délai</TableHeaderCell>
              <TableHeaderCell>Remboursé</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell></TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(policies ?? []).map((policy) => (
              <TableRow key={policy.id} className="hover:bg-surface-muted/50">
                <TableCell>{SERVICE_TYPE_LABELS[policy.serviceType]}</TableCell>
                <TableCell className="text-text-secondary">{policy.countryId ? 'Ce pays' : 'Tous pays'}</TableCell>
                <TableCell className="text-text-secondary">{policy.hoursBeforeDeparture} h avant</TableCell>
                <TableCell className="text-text-secondary">{policy.refundPercentage}%</TableCell>
                <TableCell>
                  <Badge label={policy.isActive ? 'Actif' : 'Inactif'} tone={policy.isActive ? 'success' : 'neutral'} />
                </TableCell>
                <TableCell>
                  {policy.isActive ? (
                    <button
                      onClick={() => deactivatePolicy.mutate(policy.id)}
                      className="text-xs text-danger hover:underline"
                    >
                      Désactiver
                    </button>
                  ) : null}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

export default function PricingPage() {
  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Tarification</h1>
        <p className="text-sm text-text-secondary">Commissions prélevées par la plateforme et politiques de remboursement en cas d&apos;annulation.</p>
      </div>
      <CommissionRulesSection />
      <CancellationPoliciesSection />
    </div>
  );
}
