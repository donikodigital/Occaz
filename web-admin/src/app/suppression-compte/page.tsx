// web-admin/src/app/suppression-compte/page.tsx
//
// [20/10/2026] v1 — https://occaz.sarl/suppression-compte : comment supprimer son compte et ses données, sans avoir à ouvrir l'application.
// C'est l'adresse à déclarer dans Google Play Console (Contenu de l'application › Sécurité des données › Suppression des données).
// Deux chemins : dans l'application (Profil › Aide › Supprimer votre compte), ou par e-mail à l'assistance. Les durées annoncées
// (désactivation immédiate, effacement sous 30 jours) sont celles réellement appliquées par le serveur (account-purge).
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { IconDeviceMobile, IconMail, IconTrash, IconClock, IconDatabaseOff, IconArchive } from '@tabler/icons-react';
import { COMPANY } from '@/content/legal';
import { LegalFooterLinks } from '@/components/legal/LegalDocumentView';

const MAIL_SUBJECT = encodeURIComponent("Demande de suppression de mon compte Occa'Z");
const MAIL_BODY = encodeURIComponent(
  "Bonjour,\n\nJe demande la suppression de mon compte Occa'Z et de mes données personnelles.\n\nNuméro de téléphone du compte : \nPrénom et nom : \n\nMerci.",
);

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-border bg-surface p-5 shadow-lg shadow-primary-dark/10 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">{icon}</span>
        <h2 className="text-base font-bold text-primary-dark">{title}</h2>
      </div>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-text-secondary">{children}</div>
    </section>
  );
}

export default function AccountDeletionPage() {
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
          <h1 className="relative mt-6 text-2xl font-bold leading-tight sm:text-3xl">Supprimer mon compte Occa&apos;Z</h1>
          <p className="relative mt-2 text-sm text-white/80">
            Vous pouvez demander la suppression de votre compte et de vos données personnelles à tout moment, gratuitement.
          </p>
        </section>

        <Card icon={<IconDeviceMobile size={22} aria-hidden />} title="Option 1 — Depuis l’application">
          <ol className="flex list-decimal flex-col gap-1.5 pl-5 marker:font-semibold marker:text-primary">
            <li>Ouvrez Occa&apos;Z et connectez-vous.</li>
            <li>Allez dans l&apos;onglet <strong>Profil</strong>, puis <strong>Aide</strong>.</li>
            <li>Dans la section « Compte », touchez <strong>Supprimer votre compte</strong>.</li>
            <li>Indiquez si vous le souhaitez la raison de votre départ, puis confirmez.</li>
          </ol>
          <p>Cette option est disponible aussi bien pour les clients que pour les conducteurs.</p>
        </Card>

        <Card icon={<IconMail size={22} aria-hidden />} title="Option 2 — Sans l’application, par e-mail">
          <p>
            Vous n&apos;avez plus l&apos;application ou plus accès à votre compte ? Écrivez-nous à{' '}
            <a className="font-semibold text-primary underline-offset-2 hover:underline" href={`mailto:${COMPANY.supportEmail}`}>
              {COMPANY.supportEmail}
            </a>{' '}
            en indiquant le <strong>numéro de téléphone</strong> du compte et votre nom. Nous pouvons vous demander de confirmer votre identité avant de
            traiter la demande, pour protéger votre compte.
          </p>
          <a
            href={`mailto:${COMPANY.supportEmail}?subject=${MAIL_SUBJECT}&body=${MAIL_BODY}`}
            className="inline-flex w-fit items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-on-primary shadow-md shadow-primary-dark/20 transition hover:bg-primary-dark"
          >
            <IconMail size={18} aria-hidden />
            Envoyer ma demande
          </a>
        </Card>

        <Card icon={<IconClock size={22} aria-hidden />} title="Ce qui se passe ensuite">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
            <li>Votre compte est <strong>désactivé immédiatement</strong> : vous ne pouvez plus vous connecter.</li>
            <li>
              Vos données personnelles sont <strong>effacées ou anonymisées au plus tard 30 jours</strong> après la demande.
            </li>
            <li>
              Si une réservation, un envoi ou un trajet est en cours, un retrait ou un litige en attente, ou s&apos;il reste un solde dans le
              portefeuille d&apos;un conducteur, la suppression attend que la situation soit réglée.
            </li>
          </ul>
        </Card>

        <Card icon={<IconDatabaseOff size={22} aria-hidden />} title="Données effacées">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
            <li>Numéro de téléphone, adresse e-mail, mot de passe, nom, photo, date de naissance, adresse.</li>
            <li>Pièces d&apos;identité, permis, carte grise et assurance (conducteurs), photos du véhicule.</li>
            <li>Cartes enregistrées, contacts d&apos;urgence, adresses enregistrées, appareils et sessions, notifications.</li>
            <li>Messages que vous avez écrits, commentaires d&apos;avis, détails des signalements et position des alertes SOS.</li>
          </ul>
        </Card>

        <Card icon={<IconArchive size={22} aria-hidden />} title="Données conservées">
          <p>
            Certaines données doivent être conservées par la loi ou pour protéger les autres utilisateurs. Elles ne sont plus rattachées à votre identité
            (le compte devient « Compte supprimé ») :
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-primary">
            <li>les paiements, remboursements, commissions et mouvements de portefeuille, pendant la durée légale des pièces comptables ;</li>
            <li>les réservations, envois et trajets passés, sous forme anonyme, dont les autres parties ont besoin pour leur propre historique ;</li>
            <li>les décisions de litige et le journal de sécurité, le temps de la prescription.</li>
          </ul>
          <p>
            Pour en savoir plus, consultez la{' '}
            <Link className="font-semibold text-primary underline-offset-2 hover:underline" href="/confidentialite">
              politique de confidentialité
            </Link>
            .
          </p>
        </Card>

        <div className="flex flex-col items-center gap-2 pb-2">
          <LegalFooterLinks />
          <p className="flex items-center gap-1 text-center text-xs text-text-muted">
            <IconTrash size={12} aria-hidden /> © 2026 {COMPANY.brand} · {COMPANY.website.replace('https://', '')}
          </p>
        </div>
      </div>
    </main>
  );
}
