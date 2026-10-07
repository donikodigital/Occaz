// web-admin/src/app/rejoindre/page.tsx
//
// [07/10/2026] v1 — Page publique d'invitation : https://occaz.sarl/rejoindre?code=ABCD1234
//
// C'est le lien que l'app met dans le message de parrainage. La personne invitée y voit le code de son parrain (avec un bouton
// « Copier »), les trois gestes à faire, et les boutons d'installation. Pas besoin d'être connecté.
//
// Boutons d'installation : ils s'activent tout seuls quand les liens des boutiques sont renseignés, dans les variables
// d'environnement du site (puis redéploiement, car elles sont intégrées au build) :
//   NEXT_PUBLIC_PLAY_STORE_URL  ex. https://play.google.com/store/apps/details?id=sarl.occaz.app
//   NEXT_PUBLIC_APP_STORE_URL   ex. https://apps.apple.com/app/idXXXXXXXXXX
// Tant qu'un lien est absent, son bouton affiche « Bientôt sur … » (désactivé) : rien à modifier dans le code à la publication.
//
// Le code est lu côté navigateur (window.location) et n'est affiché que s'il a la forme d'un code de parrainage (lettres
// majuscules et chiffres, 4 à 16 caractères) : tout autre contenu du paramètre est ignoré.
'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import {
  IconBrandApple,
  IconBrandGooglePlay,
  IconCheck,
  IconClock,
  IconCopy,
  IconDownload,
  IconGift,
  IconUserPlus,
} from '@tabler/icons-react';

const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL?.trim() ?? '';
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL?.trim() ?? '';

const CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

type Platform = 'android' | 'ios' | 'other';

function isStoreUrl(value: string): boolean {
  return value.startsWith('https://');
}

function detectPlatform(): Platform {
  const agent = navigator.userAgent;
  if (/android/i.test(agent)) return 'android';
  if (/iphone|ipad|ipod/i.test(agent)) return 'ios';
  return 'other';
}

function StoreButton({
  href,
  platform,
  primary,
}: {
  href: string;
  platform: 'android' | 'ios';
  primary: boolean;
}) {
  const isAndroid = platform === 'android';
  const store = isAndroid ? 'Google Play' : 'l’App Store';
  const Icon = isAndroid ? IconBrandGooglePlay : IconBrandApple;
  const available = isStoreUrl(href);

  const base = 'flex w-full items-center gap-3 rounded-2xl px-5 py-4 text-left transition';
  const tone = !available
    ? 'cursor-not-allowed border border-border bg-surface-muted text-text-muted'
    : primary
      ? 'bg-primary-dark text-on-primary shadow-lg shadow-primary-dark/25 hover:bg-primary'
      : 'border border-primary-accent bg-surface text-primary-dark shadow-sm hover:bg-primary-light';

  const content = (
    <>
      <Icon size={26} stroke={1.8} aria-hidden />
      <span className="flex flex-col leading-tight">
        <span className="text-xs opacity-80">{available ? 'Disponible sur' : 'Bientôt sur'}</span>
        <span className="text-base font-semibold">{isAndroid ? 'Google Play' : 'App Store'}</span>
      </span>
      {available ? null : <IconClock size={18} className="ml-auto" aria-hidden />}
    </>
  );

  if (!available) {
    return (
      <div className={`${base} ${tone}`} role="note" aria-label={`Bientôt disponible sur ${store}`}>
        {content}
      </div>
    );
  }
  return (
    <a href={href} className={`${base} ${tone}`} rel="noopener noreferrer" aria-label={`Télécharger Occa'Z sur ${store}`}>
      {content}
    </a>
  );
}

function Step({ number, icon, title, text }: { number: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-light text-primary">
        {icon}
        <span className="absolute -bottom-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-primary-dark ring-2 ring-surface">
          {number}
        </span>
      </span>
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold text-primary-dark">{title}</span>
        <span className="text-sm text-text-secondary">{text}</span>
      </span>
    </li>
  );
}

export default function JoinPage() {
  const [code, setCode] = useState<string | null>(null);
  const [platform, setPlatform] = useState<Platform>('other');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('code')?.trim().toUpperCase() ?? '';
    setCode(CODE_PATTERN.test(raw) ? raw : null);
    setPlatform(detectPlatform());
  }, []);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papiers refusé (navigateur intégré à une appli, page non sécurisée…) : le code reste affiché et sélectionnable.
    }
  }

  // Sur iPhone, l'App Store passe en premier ; partout ailleurs, Google Play d'abord (Android, ordinateur).
  const stores: ('android' | 'ios')[] = platform === 'ios' ? ['ios', 'android'] : ['android', 'ios'];
  const storeUrl = { android: PLAY_STORE_URL, ios: APP_STORE_URL };

  return (
    <main className="min-h-screen bg-linear-to-b from-primary-light via-background to-background px-4 py-8 sm:py-12">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-3xl bg-(image:--gradient-ocean) px-6 pb-7 pt-6 text-on-primary shadow-xl shadow-primary-dark/20">
          <span className="pointer-events-none absolute -right-12 -top-14 h-44 w-44 rounded-full bg-white/10" aria-hidden />
          <span className="pointer-events-none absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-white/10" aria-hidden />

          <div className="relative flex items-center gap-3">
            <Image
              src="/brand/logo.png"
              alt=""
              width={44}
              height={44}
              className="rounded-xl bg-white/15 p-1"
              priority
            />
            <span className="text-lg font-bold tracking-tight">Occa&apos;Z</span>
          </div>

          <h1 className="relative mt-6 text-2xl font-bold leading-tight">Un ami vous invite sur Occa&apos;Z</h1>
          <p className="relative mt-2 text-sm text-white/80">
            Voyagez en partage et envoyez vos colis avec des conducteurs de confiance, en Guinée et dans la zone XOF.
          </p>
        </section>

        {/* Code de parrainage */}
        {code ? (
          <section className="rounded-3xl border border-primary-accent bg-surface p-5 shadow-lg shadow-primary-dark/10">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <IconGift size={16} aria-hidden />
              Code de parrainage
            </div>
            <p
              className="mt-3 select-all break-all text-center text-4xl font-extrabold tracking-[0.25em] text-primary-dark"
              aria-label={`Code de parrainage : ${code.split('').join(' ')}`}
            >
              {code}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 text-base font-semibold transition ${
                copied
                  ? 'bg-success-light text-success-dark'
                  : 'bg-primary-light text-primary hover:bg-primary-accent'
              }`}
            >
              {copied ? <IconCheck size={20} aria-hidden /> : <IconCopy size={20} aria-hidden />}
              {copied ? 'Code copié' : 'Copier le code'}
            </button>
            <p className="mt-3 text-center text-xs text-text-secondary">
              Gardez-le : vous le saisirez dans l&apos;application après avoir créé votre compte.
            </p>
          </section>
        ) : null}

        {/* Comment faire */}
        <section aria-labelledby="how-title" className="flex flex-col gap-3">
          <h2 id="how-title" className="px-1 text-sm font-bold uppercase tracking-wider text-primary">
            Comment ça marche
          </h2>
          <ol className="flex flex-col gap-3">
            <Step
              number={1}
              icon={<IconDownload size={22} aria-hidden />}
              title="Installez l’application"
              text="Téléchargez Occa’Z sur votre téléphone."
            />
            <Step
              number={2}
              icon={<IconUserPlus size={22} aria-hidden />}
              title="Créez votre compte"
              text="Inscrivez-vous avec votre numéro de téléphone."
            />
            <Step
              number={3}
              icon={<IconGift size={22} aria-hidden />}
              title="Saisissez le code"
              text={
                code
                  ? 'Dans Profil › Parrainez des amis, collez le code dans « Un code à saisir ? » puis touchez Valider.'
                  : 'Dans Profil › Parrainez des amis, saisissez le code de votre ami dans « Un code à saisir ? ».'
              }
            />
          </ol>
        </section>

        {/* Installation */}
        <section aria-labelledby="install-title" className="flex flex-col gap-3">
          <h2 id="install-title" className="px-1 text-sm font-bold uppercase tracking-wider text-primary">
            Installer l&apos;application
          </h2>
          {stores.map((store, index) => (
            <StoreButton key={store} platform={store} href={storeUrl[store]} primary={index === 0} />
          ))}
          {!isStoreUrl(PLAY_STORE_URL) && !isStoreUrl(APP_STORE_URL) ? (
            <p className="px-1 text-center text-xs text-text-secondary">
              L&apos;application arrive très bientôt sur les boutiques. {code ? 'Gardez votre code, il vous sera utile dès l’installation.' : ''}
            </p>
          ) : null}
        </section>

        <p className="pb-2 text-center text-xs text-text-muted">© 2026 Occa&apos;Z · occaz.sarl</p>
      </div>
    </main>
  );
}
