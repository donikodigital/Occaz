// web-admin/src/app/(app)/shipment-categories/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { IconPlus } from '@tabler/icons-react';
import { Badge, Button, Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '@/components/ui';
import { useShipmentCategories } from '@/hooks/useShipmentCategories';

export default function ShipmentCategoriesPage() {
  const { data: categories, isLoading, isError } = useShipmentCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Catégories d&apos;envoi</h1>
          <p className="text-sm text-text-secondary">Types de colis autorisés et leur majoration de tarif.</p>
        </div>
        <Link href="/shipment-categories/new">
          <Button>
            <IconPlus size={16} />
            Ajouter une catégorie
          </Button>
        </Link>
      </div>

      {isError ? (
        <p className="text-sm text-danger">Impossible de charger les catégories.</p>
      ) : isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Nom</TableHeaderCell>
              <TableHeaderCell>Majoration tarif</TableHeaderCell>
              <TableHeaderCell>Portée</TableHeaderCell>
              <TableHeaderCell>Statut</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(categories ?? []).map((category) => (
              <TableRow key={category.id} className="hover:bg-surface-muted/50">
                <TableCell>
                  <Link href={`/shipment-categories/${category.id}`} className="font-medium text-primary hover:underline">
                    {category.name}
                  </Link>
                </TableCell>
                <TableCell className="text-text-secondary">×{category.priceMultiplier}</TableCell>
                <TableCell className="text-text-secondary">{category.countryId ? 'Ce pays' : 'Tous pays'}</TableCell>
                <TableCell>
                  <Badge label={category.isAllowed ? 'Autorisée' : 'Interdite'} tone={category.isAllowed ? 'success' : 'danger'} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
