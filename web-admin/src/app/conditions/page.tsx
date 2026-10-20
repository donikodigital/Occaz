// web-admin/src/app/conditions/page.tsx
// [20/10/2026] v1 — https://occaz.sarl/conditions : conditions générales (texte de src/content/legal.ts, identique à l'application).
import React from 'react';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { TERMS_OF_USE } from '@/content/legal';

export default function TermsPage() {
  return <LegalDocumentView document={TERMS_OF_USE} />;
}
