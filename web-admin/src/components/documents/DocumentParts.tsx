// web-admin/src/components/documents/DocumentParts.tsx
// [25/10/2026] v1 — Éléments visuels des documents de l'entreprise : icône d'un type de fichier, pastille de catégorie.
'use client';

import React from 'react';
import { IconFile, IconFileTypeDoc, IconFileTypePdf, IconFileTypePpt, IconFileTypeXls, IconPhoto } from '@tabler/icons-react';
import { Chip, IconTile, type Tone } from '@/components/admin/AdminUi';
import { CATEGORY_LABELS, CATEGORY_TONES, fileKindOf, type FileKind } from '@/utils/companyDocuments';
import type { CompanyDocumentCategory } from '@/types/company-documents.types';

const KIND_ICONS: Record<FileKind, React.ReactNode> = {
  pdf: <IconFileTypePdf size={22} />,
  word: <IconFileTypeDoc size={22} />,
  excel: <IconFileTypeXls size={22} />,
  powerpoint: <IconFileTypePpt size={22} />,
  image: <IconPhoto size={22} />,
  other: <IconFile size={22} />,
};

/** Couleur de la pastille selon le type de fichier : repère immédiat sans lire le nom. */
const KIND_TONES: Record<FileKind, Tone> = {
  pdf: 'danger',
  word: 'primary',
  excel: 'success',
  powerpoint: 'accent',
  image: 'neutral',
  other: 'neutral',
};

export function FileKindTile({ contentType }: { contentType: string }) {
  const kind = fileKindOf(contentType);
  return <IconTile tone={KIND_TONES[kind]}>{KIND_ICONS[kind]}</IconTile>;
}

export function CategoryChip({ category }: { category: CompanyDocumentCategory }) {
  return <Chip tone={CATEGORY_TONES[category]}>{CATEGORY_LABELS[category]}</Chip>;
}
