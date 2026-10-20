// web-admin/src/app/confidentialite/page.tsx
// [20/10/2026] v1 — https://occaz.sarl/confidentialite : politique de confidentialité (texte de src/content/legal.ts, identique à l'application).
import React from 'react';
import { LegalDocumentView } from '@/components/legal/LegalDocumentView';
import { PRIVACY_POLICY } from '@/content/legal';

export default function PrivacyPage() {
  return <LegalDocumentView document={PRIVACY_POLICY} />;
}
