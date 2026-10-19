// web-admin/src/components/admin/ShipmentPhotosCard.tsx
// [19/10/2026] v1 — Carte « Photos du colis » du détail d'un envoi : les 2 photos prises par l'expéditeur, ouvertes en grand dans un
// nouvel onglet. Rien ne s'affiche s'il n'y a pas de photo (ou si le compte n'a pas accès à cet envoi).
'use client';

import React from 'react';
import { SectionCard } from '@/components/admin/AdminUi';
import { useShipmentPhotos } from '@/hooks/useShipmentPhotos';

export function ShipmentPhotosCard({ shipmentId }: { shipmentId: string }) {
  const { data: photos } = useShipmentPhotos(shipmentId);
  if (!photos || photos.length === 0) return null;

  return (
    <SectionCard title="Photos du colis" description="Prises par l'expéditeur à la création de l'envoi — visibles aussi du conducteur.">
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        {photos.map((photo, index) => (
          <a
            key={photo.id}
            href={photo.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Ouvrir la photo ${index + 1} du colis en grand`}
            className="group block overflow-hidden rounded-2xl border border-border bg-border/30 shadow-sm transition hover:shadow-md"
          >
            {/* Image signée, hébergée hors du site : <img> simple, pas d'optimisation Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt={`Photo ${index + 1} du colis`}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="aspect-square w-full object-cover transition group-hover:scale-[1.02]"
            />
          </a>
        ))}
      </div>
    </SectionCard>
  );
}
