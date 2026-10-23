// web-admin/src/components/legal/LegalDocumentView.tsx
//
// [24/10/2026] v1b — LegalFooterLinks : prop `showAccountDeletion` (vrai par défaut) ; la page de connexion de l'équipe masque « Supprimer mon compte »,
// qui ne concerne que les clients et conducteurs.
// [20/10/2026] v1 — Mise en page des pages juridiques publiques (/confidentialite, /conditions) : un texte de src/content/legal.ts,
// sommaire cliquable, cartes à ombre (pas de tableau). Même ciel que les autres pages publiques (login, rejoindre).
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { IconInfoCircle } from '@tabler/icons-react';
import { COMPANY, LEGAL_UPDATED_AT, LEGAL_VERSION, type LegalBlock, type LegalDocument } from '@/content/legal';

/** Les pages publiques du site : liens de pied de page communs. */
export function LegalFooterLinks({ className = '', showAccountDeletion = true }: { className?: string; showAccountDeletion?: boolean }) {
  return (
    <nav aria-label="Informations légales" className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs ${className}`}>
      <Link href="/confidentialite" className="font-medium text-text-secondary underline-offset-2 hover:text-primary hover:underline">
        Confidentialité
      </Link>
      <Link href="/conditions" className="font-medium text-text-secondary underline-offset-2 hover:text-primary hover:underline">
        Conditions générales
      </Link>
      {showAccountDeletion ? (
        <Link href="/suppression-compte" className="font-medium text-text-secondary underline-offset-2 hover:text-primary hover:underline">
          Supprimer mon compte
        </Link>
      ) : null}
    </nav>
  );
}

function anchorFor(index: number): string {
  return `section-${index + 1}`;
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'ul') {
    return (
      <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-text-secondary marker:text-primary">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }
  if (block.type === 'note') {
    return (
      <div className="flex items-start gap-3 rounded-2xl border border-primary-accent bg-primary-light p-4 text-sm font-medium leading-relaxed text-primary-dark shadow-sm">
        <IconInfoCircle size={20} className="mt-0.5 shrink-0" aria-hidden />
        <p>{block.text}</p>
      </div>
    );
  }
  return <p className="text-sm leading-relaxed text-text-secondary">{block.text}</p>;
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  return (
    <main className="min-h-screen bg-linear-to-b from-primary-light via-background to-background px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <section className="relative overflow-hidden rounded-3xl bg-(image:--gradient-ocean) px-6 pb-7 pt-6 text-on-primary shadow-xl shadow-primary-dark/20">
          <span className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-white/10" aria-hidden />
          <span className="pointer-events-none absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-white/10" aria-hidden />
          <div className="relative flex items-center gap-3">
            <Image src="/brand/logo.png" alt="" width={44} height={44} className="rounded-xl bg-white/15 p-1" priority />
            <Link href="/" className="text-lg font-bold tracking-tight">
              Occa&apos;Z
            </Link>
          </div>
          <h1 className="relative mt-6 text-2xl font-bold leading-tight sm:text-3xl">{document.title}</h1>
          <p className="relative mt-2 text-sm text-white/80">
            {document.subtitle} · Dernière mise à jour : {LEGAL_UPDATED_AT} (version {LEGAL_VERSION})
          </p>
        </section>

        <section className="rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/10 sm:p-6">
          <p className="text-sm leading-relaxed text-text-secondary">{document.intro}</p>
        </section>

        <nav aria-label="Sommaire" className="rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/10 sm:p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-primary">Sommaire</h2>
          <ol className="mt-3 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
            {document.sections.map((section, index) => (
              <li key={section.title}>
                <a href={`#${anchorFor(index)}`} className="text-text-secondary underline-offset-2 hover:text-primary hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {document.sections.map((section, index) => (
          <section
            key={section.title}
            id={anchorFor(index)}
            className="scroll-mt-6 rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/10 sm:p-6"
          >
            <h2 className="text-base font-bold text-primary-dark">{section.title}</h2>
            <div className="mt-3 flex flex-col gap-3">
              {section.blocks.map((block, blockIndex) => (
                <Block key={blockIndex} block={block} />
              ))}
            </div>
          </section>
        ))}

        <div className="flex flex-col items-center gap-2 pb-2">
          <LegalFooterLinks />
          <p className="text-center text-xs text-text-muted">
            © 2026 {COMPANY.brand} · {COMPANY.website.replace('https://', '')} · {COMPANY.supportEmail}
          </p>
        </div>
      </div>
    </main>
  );
}
