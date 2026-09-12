// web-admin/src/app/(app)/payment-providers/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { IconCreditCard, IconPlus } from '@tabler/icons-react';
import { Badge, Button, Switch, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui';
import { usePaymentProviders, useTogglePaymentProviderActive } from '@/hooks/usePaymentProviders';
import { useCountries } from '@/hooks/useGeography';
import { PAYMENT_PROVIDER_TYPE_LABELS } from '@/utils/paymentProviderLabels';
import type { PaymentProvider } from '@/types/paymentProviders.types';

function ActiveToggleCell({ provider }: { provider: PaymentProvider }) {
  const toggle = useTogglePaymentProviderActive(provider.id);
  return (
    <Switch
      checked={provider.isActive}
      disabled={toggle.isPending}
      onChange={(next) => toggle.mutate(next)}
    />
  );
}

/**
 * Résout le trou opérationnel signalé pendant la livraison mobile
 * (aucun moyen de paiement n'est pré-créé en base — voir
 * backend/README.md, section "Comptes provisionnés") : c'est ici qu'on
 * en crée un pour la première fois sans passer par l'API directement.
 */
export default function PaymentProvidersPage() {
  const { data: providers, isLoading, isError } = usePaymentProviders();
  const { data: countries } = useCountries();
  const countryNameById = new Map((countries ?? []).map((c) => [c.id, c.name]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Moyens de paiement</h1>
          <p className="text-sm text-text-secondary">
            Un client ne peut payer que si au moins un moyen actif existe ici.
          </p>
        </div>
        <Link href="/payment-providers/new">
          <Button>
            <IconPlus size={16} />
            Ajouter un moyen de paiement
          </Button>
        </Link>
      </div>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les moyens de paiement.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : providers && providers.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
          <IconCreditCard size={28} className="text-text-muted" />
          <p className="text-sm text-text-secondary">
            Aucun moyen de paiement configuré — les paiements sont actuellement impossibles sur la plateforme.
          </p>
          <Link href="/payment-providers/new">
            <Button>Ajouter le premier moyen de paiement</Button>
          </Link>
        </div>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nom</TableHeaderCell>
              <TableHeaderCell>Type</TableHeaderCell>
              <TableHeaderCell>Pays</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
              <TableHeaderCell>Actif</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(providers ?? []).map((provider) => (
              <TableRow key={provider.id} className="hover:bg-surface-muted/50">
                <TableCell>
                  <Link href={`/payment-providers/${provider.id}`} className="font-medium text-primary hover:underline">
                    {provider.name}
                  </Link>
                </TableCell>
                <TableCell>{PAYMENT_PROVIDER_TYPE_LABELS[provider.type]}</TableCell>
                <TableCell className="text-text-secondary">
                  {provider.countryId ? (countryNameById.get(provider.countryId) ?? provider.countryId) : 'Tous pays'}
                </TableCell>
                <TableCell>
                  <Badge label={provider.isActive ? 'Actif' : 'Inactif'} tone={provider.isActive ? 'success' : 'neutral'} />
                </TableCell>
                <TableCell>
                  <ActiveToggleCell provider={provider} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
