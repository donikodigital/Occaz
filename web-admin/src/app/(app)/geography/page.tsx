// web-admin/src/app/(app)/geography/page.tsx
//
// v4 — Modales modernisées (pays, devise, ville) : carte d'identité qui se
// met à jour pendant la saisie, champs regroupés par sections, interrupteur
// « Transfrontalier » avec son explication (le composant Switch cachait le
// début du libellé), action destructrice discrète. « Supprimer » un pays
// devient « Désactiver » : c'est ce que fait réellement l'API.
//
// v3 — Refonte complète. La configuration se réduit à trois choses : les
// pays, leurs villes, et les devises. Régions et préfectures ne sont plus
// utilisées (ni affichées, ni importées) : un trajet ou un envoi part d'une
// ville et arrive dans une ville, chaque ville appartenant à un pays.
//   - Un bandeau d'accueil avec les trois chiffres clés (cliquables) ;
//   - trois onglets au lieu d'une longue page : Pays, Villes, Devises ;
//   - Villes : choix du pays en pastilles, barre de progression des
//     coordonnées GPS (elles servent à retrouver la ville d'une adresse),
//     filtre « Sans GPS » pour compléter vite ;
//   - formulaire de ville : nom, adresse, et un seul champ de coordonnées
//     où l'on colle ce que copie Google Maps.

'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  IconAlertTriangle,
  IconChevronRight,
  IconCircleCheck,
  IconCoin,
  IconExternalLink,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react';
import { Badge, Button, Modal, Select, TextField } from '@/components/ui';
import {
  useCities,
  useCountries,
  useCreateCity,
  useCreateCountry,
  useCreateCurrency,
  useCurrencies,
  useDeactivateCountry,
  useDeleteCity,
  useDeleteCurrency,
  useUpdateCity,
  useUpdateCountry,
  useUpdateCurrency,
} from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';
import type { City, Country, Currency } from '@/types/geography.types';

// ---------------------------------------------------------------------------
// Aides
// ---------------------------------------------------------------------------

function isoToFlagEmoji(isoCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(isoCode)) return '🏳️';
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function plural(count: number, singular: string): string {
  return count > 1 ? `${singular}s` : singular;
}

// Accepte ce que copie Google Maps ("9.5370, -13.6773") ainsi que les
// variantes courantes : séparateur point-virgule ou espace, virgule décimale.
const DECIMAL = '-?\\d+(?:[.,]\\d+)?';
const COORDINATES_PATTERN = new RegExp(`^(${DECIMAL})\\s*[;,\\s]\\s*(${DECIMAL})$`);

function parseCoordinates(value: string): { latitude: number; longitude: number } | undefined {
  const match = COORDINATES_PATTERN.exec(value.trim());
  if (!match) return undefined;
  const [, rawLatitude = '', rawLongitude = ''] = match;
  const latitude = Number(rawLatitude.replace(',', '.'));
  const longitude = Number(rawLongitude.replace(',', '.'));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return undefined;
  return { latitude, longitude };
}

function hasCoordinates(city: City): boolean {
  return city.latitude != null && city.longitude != null;
}

function formatCoordinates(city: City): string | undefined {
  if (city.latitude == null || city.longitude == null) return undefined;
  return `${city.latitude.toFixed(4)}, ${city.longitude.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Briques d'interface
// ---------------------------------------------------------------------------

type TabId = 'countries' | 'cities' | 'currencies';

interface TabItem {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  count?: number;
}

interface HeroStat {
  id: TabId;
  icon: React.ReactNode;
  value: string;
  label: string;
  sublabel?: string;
}

function Hero({ stats, onSelectTab }: { stats: HeroStat[]; onSelectTab: (tab: TabId) => void }) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-primary/75 p-5 shadow-lg sm:p-7">
      <span className="pointer-events-none absolute -right-12 -top-16 h-52 w-52 rounded-full bg-[rgba(255,255,255,0.10)]" />
      <span className="pointer-events-none absolute -bottom-20 left-8 h-44 w-44 rounded-full bg-[rgba(255,255,255,0.07)]" />

      <div className="relative">
        <p className="text-sm font-medium text-[rgba(255,255,255,0.75)]">Réglage ponctuel</p>
        <h1 className="mt-1 text-2xl font-bold text-[#ffffff] sm:text-3xl">Géographie</h1>
        <p className="mt-1.5 max-w-xl text-sm text-[rgba(255,255,255,0.82)]">
          Les pays, leurs villes et les devises où la plateforme opère. Un trajet ou un envoi part d’une ville et arrive
          dans une ville.
        </p>
      </div>

      <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map((stat) => (
          <button
            key={stat.id}
            type="button"
            onClick={() => onSelectTab(stat.id)}
            className="group flex min-w-0 flex-col items-start gap-1 rounded-2xl bg-[rgba(255,255,255,0.14)] p-3 text-left backdrop-blur-sm transition hover:bg-[rgba(255,255,255,0.22)] sm:p-4"
          >
            <span className="text-[#ffffff]">{stat.icon}</span>
            <span className="text-xl font-bold leading-none text-[#ffffff] sm:text-2xl">{stat.value}</span>
            <span className="text-xs font-semibold text-[#ffffff]">{stat.label}</span>
            {stat.sublabel ? (
              <span className="w-full truncate text-[11px] text-[rgba(255,255,255,0.72)]">{stat.sublabel}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function TabBar({ active, items, onChange }: { active: TabId; items: TabItem[]; onChange: (tab: TabId) => void }) {
  return (
    <div role="tablist" className="flex gap-1 rounded-2xl border border-border bg-surface p-1 shadow-sm">
      {items.map((item) => {
        const isActive = item.id === active;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(item.id)}
            className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              isActive ? 'bg-primary text-[#ffffff] shadow-sm' : 'text-text-secondary hover:bg-primary-light/50'
            }`}
          >
            <span className="hidden sm:inline-flex">{item.icon}</span>
            <span className="truncate">{item.label}</span>
            {item.count !== undefined ? (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                  isActive ? 'bg-[rgba(255,255,255,0.22)] text-[#ffffff]' : 'bg-primary-light text-primary'
                }`}
              >
                {item.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-0 flex-1">
      <IconSearch size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-surface py-2.5 pl-10 pr-3 text-sm text-text-primary shadow-sm placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function Toolbar({
  search,
  onSearch,
  searchPlaceholder,
  showSearch,
  actionLabel,
  onAction,
  actionDisabled,
}: {
  search: string;
  onSearch: (value: string) => void;
  searchPlaceholder: string;
  showSearch: boolean;
  actionLabel: string;
  onAction: () => void;
  actionDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      {showSearch ? <SearchInput value={search} onChange={onSearch} placeholder={searchPlaceholder} /> : <div className="flex-1" />}
      <Button type="button" onClick={onAction} disabled={actionDisabled} className="shrink-0">
        <IconPlus size={16} />
        {actionLabel}
      </Button>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-2xl bg-accent-light px-4 py-3 text-sm text-accent-dark">
      <IconAlertTriangle size={18} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-3xl border border-dashed border-border bg-surface px-6 py-10 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-light text-primary">{icon}</span>
      <p className="mt-4 font-semibold text-text-primary">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-text-secondary">{text}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function SkeletonGrid({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-28 animate-pulse rounded-2xl bg-border/50" />
      ))}
    </div>
  );
}

const CARD_CLASSES =
  'group flex w-full rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md';

// ---------------------------------------------------------------------------
// Pays
// ---------------------------------------------------------------------------

function CountryCard({ country, currencies, onClick }: { country: Country; currencies: Currency[]; onClick: () => void }) {
  const currency = currencies.find((c) => c.id === country.defaultCurrencyId);
  const missingCurrency = !country.defaultCurrencyId;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${CARD_CLASSES} flex-col gap-3 ${country.isActive ? '' : 'opacity-70'} ${
        missingCurrency ? 'border-danger-light' : ''
      }`}
    >
      <div className="flex w-full items-start justify-between">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-light text-2xl leading-none" aria-hidden="true">
          {isoToFlagEmoji(country.isoCode)}
        </span>
        <IconChevronRight size={18} className="text-text-muted transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="min-w-0">
        <p className="truncate font-semibold text-text-primary">{country.name}</p>
        <p className="text-xs text-text-secondary">
          {country.isoCode} · {country.phoneCode}
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {!country.isActive ? <Badge label="Désactivé" tone="neutral" /> : null}
        {missingCurrency ? <Badge label="Devise manquante" tone="danger" /> : <Badge label={currency?.isoCode ?? '—'} tone="primary" />}
        {country.isCrossBorderEnabled ? <Badge label="Transfrontalier" tone="success" /> : null}
      </div>
    </button>
  );
}

function CountriesTab({
  countries,
  currencies,
  isLoading,
  onSelectCountry,
  onAddCountry,
}: {
  countries: Country[];
  currencies: Currency[];
  isLoading: boolean;
  onSelectCountry: (country: Country) => void;
  onAddCountry: () => void;
}) {
  const [search, setSearch] = useState('');
  const missingCount = countries.filter((c) => !c.defaultCurrencyId).length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return countries;
    return countries.filter((c) => c.name.toLowerCase().includes(query) || c.isoCode.toLowerCase().includes(query));
  }, [countries, search]);

  return (
    <div className="space-y-4">
      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Rechercher un pays…"
        showSearch={countries.length > 5}
        actionLabel="Ajouter un pays"
        onAction={onAddCountry}
      />

      {missingCount > 0 ? (
        <Notice>
          {missingCount} {plural(missingCount, 'pays')} sans devise par défaut : choisis-en une pour que les tarifs et les
          portefeuilles fonctionnent.
        </Notice>
      ) : null}

      {isLoading ? (
        <SkeletonGrid />
      ) : countries.length === 0 ? (
        <EmptyState
          icon={<IconWorld size={26} />}
          title="Aucun pays pour l’instant"
          text="Commence par ajouter le pays où tu opères, puis ses villes."
          action={
            <Button type="button" onClick={onAddCountry}>
              <IconPlus size={16} />
              Ajouter un pays
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">Aucun pays ne correspond à cette recherche.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((country) => (
            <CountryCard key={country.id} country={country} currencies={currencies} onClick={() => onSelectCountry(country)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Villes
// ---------------------------------------------------------------------------

function CityCard({ city, onClick }: { city: City; onClick: () => void }) {
  const coordinates = formatCoordinates(city);
  return (
    <button type="button" onClick={onClick} className={`${CARD_CLASSES} items-start gap-3`}>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent-light text-sm font-bold text-accent-dark">
        {city.name.slice(0, 2).toUpperCase()}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-semibold text-text-primary">{city.name}</p>
          <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
        </div>
        {city.address ? <p className="truncate text-xs text-text-secondary">{city.address}</p> : null}
        <div className="mt-2">
          {coordinates ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-xs font-medium text-success-dark">
              <IconMapPin size={12} />
              {coordinates}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent-dark">
              <IconAlertTriangle size={12} />
              Coordonnées à ajouter
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function CitiesTab({
  countries,
  countryId,
  onCountryChange,
  cities,
  isLoading,
  onAddCity,
  onEditCity,
  onGoToCountries,
}: {
  countries: Country[];
  countryId: string;
  onCountryChange: (countryId: string) => void;
  cities: City[];
  isLoading: boolean;
  onAddCity: () => void;
  onEditCity: (city: City) => void;
  onGoToCountries: () => void;
}) {
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(false);

  useEffect(() => {
    setSearch('');
    setOnlyMissing(false);
  }, [countryId]);

  const sorted = useMemo(() => [...cities].sort((a, b) => a.name.localeCompare(b.name)), [cities]);
  const withCoordinates = sorted.filter(hasCoordinates).length;
  const missing = sorted.length - withCoordinates;
  const percent = sorted.length > 0 ? Math.round((withCoordinates / sorted.length) * 100) : 0;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sorted.filter((city) => {
      if (onlyMissing && hasCoordinates(city)) return false;
      if (!query) return true;
      return city.name.toLowerCase().includes(query) || (city.address ?? '').toLowerCase().includes(query);
    });
  }, [sorted, search, onlyMissing]);

  if (countries.length === 0) {
    return (
      <EmptyState
        icon={<IconWorld size={26} />}
        title="Ajoute d’abord un pays"
        text="Chaque ville appartient à un pays. Crée le pays, puis reviens ici pour ses villes."
        action={
          <Button type="button" onClick={onGoToCountries}>
            <IconPlus size={16} />
            Ajouter un pays
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {countries.map((country) => {
          const isActive = country.id === countryId;
          return (
            <button
              key={country.id}
              type="button"
              onClick={() => onCountryChange(country.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition ${
                isActive
                  ? 'border-primary bg-primary text-[#ffffff] shadow-sm'
                  : 'border-border bg-surface text-text-primary hover:border-primary/40'
              }`}
            >
              <span aria-hidden="true">{isoToFlagEmoji(country.isoCode)}</span>
              {country.name}
              {!country.isActive ? <span className="text-xs opacity-70">(désactivé)</span> : null}
            </button>
          );
        })}
      </div>

      {sorted.length > 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Localisation des villes</p>
              <p className="text-xs text-text-secondary">
                {withCoordinates} sur {sorted.length} avec coordonnées GPS
              </p>
            </div>
            <span className="text-lg font-bold text-primary">{percent}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-light">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
          </div>
          <p className="mt-2 text-xs text-text-muted">
            Les coordonnées permettent à l’app de retrouver automatiquement la ville d’une adresse choisie par un chauffeur.
          </p>
        </div>
      ) : null}

      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Rechercher une ville…"
        showSearch={sorted.length > 5}
        actionLabel="Ajouter une ville"
        onAction={onAddCity}
        actionDisabled={!countryId}
      />

      {missing > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOnlyMissing(false)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              !onlyMissing ? 'border-primary bg-primary-light text-primary' : 'border-border bg-surface text-text-secondary'
            }`}
          >
            Toutes ({sorted.length})
          </button>
          <button
            type="button"
            onClick={() => setOnlyMissing(true)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              onlyMissing ? 'border-primary bg-primary-light text-primary' : 'border-border bg-surface text-text-secondary'
            }`}
          >
            Sans GPS ({missing})
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <SkeletonGrid />
      ) : sorted.length === 0 ? (
        <EmptyState
          icon={<IconMapPin size={26} />}
          title="Aucune ville pour ce pays"
          text="Ajoute les villes d’où partent et où arrivent les trajets et les envois."
          action={
            <Button type="button" onClick={onAddCity}>
              <IconPlus size={16} />
              Ajouter une ville
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">Aucune ville ne correspond.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((city) => (
            <CityCard key={city.id} city={city} onClick={() => onEditCity(city)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Devises
// ---------------------------------------------------------------------------

function CurrencyCard({ currency, onClick }: { currency: Currency; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`${CARD_CLASSES} items-center gap-3`}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-light text-sm font-bold text-primary">
        {currency.symbol ?? currency.isoCode.slice(0, 2)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{currency.name}</p>
        <p className="text-xs text-text-secondary">
          {currency.decimalDigits === 0 ? 'Sans décimales' : `${currency.decimalDigits} ${plural(currency.decimalDigits, 'décimale')}`}
        </p>
      </div>
      <Badge label={currency.isoCode} tone="neutral" />
      <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function CurrenciesTab({
  currencies,
  isLoading,
  onSelectCurrency,
  onAddCurrency,
}: {
  currencies: Currency[];
  isLoading: boolean;
  onSelectCurrency: (currency: Currency) => void;
  onAddCurrency: () => void;
}) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return currencies;
    return currencies.filter((c) => c.name.toLowerCase().includes(query) || c.isoCode.toLowerCase().includes(query));
  }, [currencies, search]);

  return (
    <div className="space-y-4">
      <Toolbar
        search={search}
        onSearch={setSearch}
        searchPlaceholder="Rechercher une devise…"
        showSearch={currencies.length > 5}
        actionLabel="Ajouter une devise"
        onAction={onAddCurrency}
      />

      <p className="text-sm text-text-secondary">Utilisées pour les pays, les tarifs et les portefeuilles.</p>

      {isLoading ? (
        <SkeletonGrid count={2} />
      ) : currencies.length === 0 ? (
        <EmptyState
          icon={<IconCoin size={26} />}
          title="Aucune devise pour l’instant"
          text="Ajoute la devise utilisée par tes pays (ex. le franc guinéen ou le franc CFA)."
          action={
            <Button type="button" onClick={onAddCurrency}>
              <IconPlus size={16} />
              Ajouter une devise
            </Button>
          }
        />
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-text-muted">Aucune devise ne correspond à cette recherche.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((currency) => (
            <CurrencyCard key={currency.id} currency={currency} onClick={() => onSelectCurrency(currency)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaires (modales)
// ---------------------------------------------------------------------------

/** En-tête « carte d'identité » : se met à jour pendant la saisie. */
function IdentityPreview({
  tile,
  title,
  subtitle,
  badge,
}: {
  tile: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-primary-light/50 p-4">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface shadow-sm">{tile}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-text-primary">{title}</p>
        {subtitle ? <p className="truncate text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
      {badge}
    </div>
  );
}

function FormSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        {description ? <p className="text-xs text-text-secondary">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

/** Interrupteur avec son explication — remplace le composant Switch, dont le libellé passait sous la pastille. */
function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition hover:border-primary/40"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary">{label}</span>
        {description ? <span className="mt-0.5 block text-xs text-text-secondary">{description}</span> : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-border'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-[#ffffff] shadow transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </span>
    </button>
  );
}

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl bg-danger-light/40 px-3 py-2.5 text-sm text-danger-dark">
      <IconAlertTriangle size={16} className="mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

interface DestructiveAction {
  label: string;
  question: string;
  confirming: boolean;
  isPending: boolean;
  onAsk: () => void;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Pied de modale commun : action destructrice discrète à gauche, Fermer / Enregistrer à droite. */
function ModalActions({
  formId,
  submitLabel,
  saving,
  submitDisabled,
  onClose,
  destructive,
}: {
  formId: string;
  submitLabel: string;
  saving: boolean;
  submitDisabled?: boolean;
  onClose: () => void;
  destructive?: DestructiveAction;
}) {
  const confirming = destructive?.confirming === true;
  return (
    <>
      {destructive ? (
        confirming ? (
          <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-2xl bg-danger-light/40 px-4 py-3">
            <span className="text-sm font-medium text-danger-dark">{destructive.question}</span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={destructive.onCancel}>
                Annuler
              </Button>
              <Button variant="danger" loading={destructive.isPending} onClick={destructive.onConfirm}>
                Confirmer
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={destructive.onAsk}
            className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-danger transition hover:bg-danger-light/40"
          >
            <IconTrash size={16} />
            {destructive.label}
          </button>
        )
      ) : null}
      {!confirming ? (
        <>
          <Button variant="ghost" onClick={onClose}>
            Fermer
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={submitDisabled}>
            {submitLabel}
          </Button>
        </>
      ) : null}
    </>
  );
}

function CountryFormModal({
  open,
  onClose,
  country,
  currencies,
}: {
  open: boolean;
  onClose: () => void;
  country: Country | null;
  currencies: Currency[];
}) {
  const createCountry = useCreateCountry();
  const updateCountry = useUpdateCountry();
  const deactivateCountry = useDeactivateCountry();

  const [isoCode, setIsoCode] = useState('');
  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [defaultCurrencyId, setDefaultCurrencyId] = useState('');
  const [isCrossBorderEnabled, setIsCrossBorderEnabled] = useState(false);
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setIsoCode(country?.isoCode ?? '');
    setName(country?.name ?? '');
    setPhoneCode(country?.phoneCode ?? '');
    setDefaultCurrencyId(country?.defaultCurrencyId ?? '');
    setIsCrossBorderEnabled(country?.isCrossBorderEnabled ?? false);
    setConfirmingDeactivate(false);
    setErrorMessage(undefined);
  }, [open, country]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      if (country) {
        await updateCountry.mutateAsync({
          id: country.id,
          isoCode: isoCode.toUpperCase(),
          name,
          phoneCode,
          defaultCurrencyId: defaultCurrencyId || null,
          isCrossBorderEnabled,
        });
      } else {
        await createCountry.mutateAsync({
          isoCode: isoCode.toUpperCase(),
          name,
          phoneCode,
          defaultCurrencyId: defaultCurrencyId || undefined,
          isCrossBorderEnabled,
        });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDeactivate() {
    if (!country) return;
    setErrorMessage(undefined);
    try {
      await deactivateCountry.mutateAsync(country.id);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDeactivate(false);
    }
  }

  const saving = createCountry.isPending || updateCountry.isPending;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={country ? 'Modifier le pays' : 'Ajouter un pays'}
      zIndex={60}
      footer={
        <ModalActions
          formId="country-form"
          submitLabel={country ? 'Enregistrer' : 'Créer le pays'}
          saving={saving}
          onClose={onClose}
          destructive={
            country && country.isActive
              ? {
                  label: 'Désactiver le pays',
                  question: 'Désactiver ce pays ? Il ne sera plus actif sur la plateforme.',
                  confirming: confirmingDeactivate,
                  isPending: deactivateCountry.isPending,
                  onAsk: () => setConfirmingDeactivate(true),
                  onCancel: () => setConfirmingDeactivate(false),
                  onConfirm: handleDeactivate,
                }
              : undefined
          }
        />
      }
    >
      <form id="country-form" onSubmit={handleSubmit} className="space-y-6">
        <IdentityPreview
          tile={<span className="text-3xl leading-none">{isoToFlagEmoji(isoCode)}</span>}
          title={name.trim() || 'Nouveau pays'}
          subtitle={`${isoCode || '—'} · ${phoneCode || '—'}`}
          badge={country && !country.isActive ? <Badge label="Désactivé" tone="neutral" /> : undefined}
        />

        <FormSection title="Identité">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Code ISO"
              value={isoCode}
              onChange={(e) => setIsoCode(e.target.value.toUpperCase())}
              placeholder="GN"
              maxLength={2}
              hint="2 lettres"
              required
            />
            <TextField label="Indicatif" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} placeholder="+224" required />
          </div>
          <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guinée" required />
        </FormSection>

        <FormSection title="Monnaie" description="Utilisée pour les tarifs et les portefeuilles de ce pays.">
          <Select label="Devise par défaut" value={defaultCurrencyId} onChange={(e) => setDefaultCurrencyId(e.target.value)}>
            <option value="">— Aucune devise —</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.name} ({currency.isoCode})
              </option>
            ))}
          </Select>
          {!defaultCurrencyId ? (
            <p className="flex items-start gap-1.5 text-xs font-medium text-accent-dark">
              <IconAlertTriangle size={14} className="mt-0.5 shrink-0" />
              Sans devise par défaut, les tarifs et les portefeuilles de ce pays ne fonctionneront pas.
            </p>
          ) : null}
        </FormSection>

        <FormSection title="Échanges entre pays">
          <ToggleRow
            checked={isCrossBorderEnabled}
            onChange={setIsCrossBorderEnabled}
            label="Transfrontalier"
            description="Autorise les trajets et les envois entre ce pays et d’autres pays."
          />
        </FormSection>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

function CurrencyFormModal({ open, onClose, currency }: { open: boolean; onClose: () => void; currency: Currency | null }) {
  const createCurrency = useCreateCurrency();
  const updateCurrency = useUpdateCurrency();
  const deleteCurrency = useDeleteCurrency();

  const [isoCode, setIsoCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [decimalDigits, setDecimalDigits] = useState(0);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  useEffect(() => {
    if (!open) return;
    setIsoCode(currency?.isoCode ?? '');
    setName(currency?.name ?? '');
    setSymbol(currency?.symbol ?? '');
    setDecimalDigits(currency?.decimalDigits ?? 0);
    setConfirmingDelete(false);
    setErrorMessage(undefined);
  }, [open, currency]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      if (currency) {
        await updateCurrency.mutateAsync({
          id: currency.id,
          isoCode: isoCode.toUpperCase(),
          name,
          symbol: symbol || undefined,
          decimalDigits,
        });
      } else {
        await createCurrency.mutateAsync({ isoCode: isoCode.toUpperCase(), name, symbol: symbol || undefined, decimalDigits });
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    if (!currency) return;
    setErrorMessage(undefined);
    try {
      await deleteCurrency.mutateAsync(currency.id);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDelete(false);
    }
  }

  const saving = createCurrency.isPending || updateCurrency.isPending;
  const decimalsLabel = decimalDigits === 0 ? 'sans décimales' : `${decimalDigits} ${plural(decimalDigits, 'décimale')}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currency ? 'Modifier la devise' : 'Ajouter une devise'}
      zIndex={60}
      footer={
        <ModalActions
          formId="currency-form"
          submitLabel={currency ? 'Enregistrer' : 'Créer la devise'}
          saving={saving}
          onClose={onClose}
          destructive={
            currency
              ? {
                  label: 'Supprimer la devise',
                  question: 'Supprimer cette devise ?',
                  confirming: confirmingDelete,
                  isPending: deleteCurrency.isPending,
                  onAsk: () => setConfirmingDelete(true),
                  onCancel: () => setConfirmingDelete(false),
                  onConfirm: handleDelete,
                }
              : undefined
          }
        />
      }
    >
      <form id="currency-form" onSubmit={handleSubmit} className="space-y-6">
        <IdentityPreview
          tile={<span className="text-lg font-bold text-primary">{symbol.trim() || isoCode || '?'}</span>}
          title={name.trim() || 'Nouvelle devise'}
          subtitle={`${isoCode || '—'} · ${decimalsLabel}`}
        />

        <FormSection title="Identité">
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Code ISO"
              value={isoCode}
              onChange={(e) => setIsoCode(e.target.value.toUpperCase())}
              placeholder="GNF"
              maxLength={3}
              hint="3 lettres"
              required
            />
            <TextField label="Symbole (optionnel)" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="FG" />
          </div>
          <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Franc guinéen" required />
        </FormSection>

        <FormSection title="Format des montants">
          <TextField
            label="Décimales"
            type="number"
            min={0}
            value={decimalDigits}
            onChange={(e) => setDecimalDigits(Number(e.target.value))}
            hint="0 pour GNF/XOF (pas de sous-unité)"
          />
        </FormSection>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

function CityFormModal({
  open,
  onClose,
  city,
  countryId,
  countryName,
}: {
  open: boolean;
  onClose: () => void;
  city: City | null;
  countryId: string;
  countryName: string;
}) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [coordinates, setCoordinates] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const createCity = useCreateCity();
  const updateCity = useUpdateCity(countryId);
  const deleteCity = useDeleteCity(countryId);

  useEffect(() => {
    if (!open) return;
    setName(city?.name ?? '');
    setAddress(city?.address ?? '');
    setCoordinates(city && hasCoordinates(city) ? `${city.latitude}, ${city.longitude}` : '');
    setConfirmingDelete(false);
    setErrorMessage(undefined);
  }, [open, city]);

  const trimmedCoordinates = coordinates.trim();
  const parsedCoordinates = trimmedCoordinates ? parseCoordinates(trimmedCoordinates) : undefined;
  const coordinatesInvalid = trimmedCoordinates.length > 0 && !parsedCoordinates;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);

    if (coordinatesInvalid) {
      setErrorMessage('Coordonnées invalides. Colle-les depuis Google Maps, par exemple : 9.5370, -13.6773');
      return;
    }

    const payload = {
      countryId,
      name: name.trim(),
      address: address.trim() || undefined,
      latitude: parsedCoordinates ? parsedCoordinates.latitude : null,
      longitude: parsedCoordinates ? parsedCoordinates.longitude : null,
    };
    try {
      if (city) {
        await updateCity.mutateAsync({ id: city.id, ...payload });
      } else {
        await createCity.mutateAsync(payload);
      }
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleDelete() {
    if (!city) return;
    setErrorMessage(undefined);
    try {
      await deleteCity.mutateAsync(city.id);
      onClose();
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
      setConfirmingDelete(false);
    }
  }

  const saving = createCity.isPending || updateCity.isPending;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name.trim()}, ${countryName}`)}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={city ? 'Modifier la ville' : 'Ajouter une ville'}
      zIndex={60}
      footer={
        <ModalActions
          formId="city-form"
          submitLabel={city ? 'Enregistrer' : 'Créer la ville'}
          saving={saving}
          submitDisabled={!name.trim()}
          onClose={onClose}
          destructive={
            city
              ? {
                  label: 'Supprimer la ville',
                  question: 'Supprimer cette ville ?',
                  confirming: confirmingDelete,
                  isPending: deleteCity.isPending,
                  onAsk: () => setConfirmingDelete(true),
                  onCancel: () => setConfirmingDelete(false),
                  onConfirm: handleDelete,
                }
              : undefined
          }
        />
      }
    >
      <form id="city-form" onSubmit={handleSubmit} className="space-y-6">
        <IdentityPreview
          tile={<span className="text-base font-bold text-accent-dark">{name.trim().slice(0, 2).toUpperCase() || '?'}</span>}
          title={name.trim() || 'Nouvelle ville'}
          subtitle={countryName}
          badge={
            parsedCoordinates ? (
              <Badge label="GPS" tone="success" />
            ) : trimmedCoordinates ? undefined : (
              <Badge label="Sans GPS" tone="neutral" />
            )
          }
        />

        <FormSection title="Ville">
          <TextField label="Nom de la ville" value={name} onChange={(e) => setName(e.target.value)} placeholder="Labé" required />
          <TextField
            label="Adresse (optionnel)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Quartier Almamya, en face du marché"
          />
        </FormSection>

        <FormSection
          title="Localisation"
          description="Le centre de la ville permet à l’app de la retrouver automatiquement à partir d’une adresse."
        >
          <TextField
            label="Coordonnées GPS (recommandé)"
            value={coordinates}
            onChange={(e) => setCoordinates(e.target.value)}
            placeholder="9.5370, -13.6773"
            hint="Sans coordonnées, la ville n'est retrouvée que par son nom."
          />
          {parsedCoordinates ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success-dark">
              <IconCircleCheck size={14} />
              Coordonnées reconnues : {parsedCoordinates.latitude}, {parsedCoordinates.longitude}
            </p>
          ) : null}
          {coordinatesInvalid ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-danger">
              <IconAlertTriangle size={14} />
              Format non reconnu — attendu : latitude, longitude
            </p>
          ) : null}
          <div className="rounded-2xl bg-border/30 p-3 text-xs text-text-secondary">
            <p>Sur Google Maps : clic droit sur le centre de la ville, puis clique sur les coordonnées pour les copier.</p>
            {name.trim() ? (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                <IconExternalLink size={14} />
                Chercher « {name.trim()} » sur Google Maps
              </a>
            ) : null}
          </div>
        </FormSection>

        <FormError message={errorMessage} />
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

// Un générique multi-lignes passé directement à useState<...> commençant par
// une accolade sur une nouvelle ligne fait planter le parseur SWC/Next.js en
// .tsx (ambiguïté avec du JSX) — d'où cet alias nommé sur une seule ligne.
type CityModalState = { mode: 'create' } | { mode: 'edit'; city: City };

export default function GeographyPage() {
  const { data: countries, isLoading: countriesLoading } = useCountries();
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();

  const [tab, setTab] = useState<TabId>('countries');
  const [countryId, setCountryId] = useState('');
  const { data: cities, isLoading: citiesLoading } = useCities(countryId || undefined);

  const [countryFormOpen, setCountryFormOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [currencyFormOpen, setCurrencyFormOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);
  const [cityModalState, setCityModalState] = useState<CityModalState | null>(null);

  // Actifs d'abord, puis par ordre alphabétique.
  const sortedCountries = useMemo(
    () => [...(countries ?? [])].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name)),
    [countries],
  );

  // Le premier pays actif est sélectionné d'office pour l'onglet Villes.
  useEffect(() => {
    if (countryId || sortedCountries.length === 0) return;
    const first = sortedCountries[0];
    if (first) setCountryId(first.id);
  }, [sortedCountries, countryId]);

  const selectedCityCountry = sortedCountries.find((country) => country.id === countryId);
  const activeCountries = sortedCountries.filter((country) => country.isActive).length;
  const citiesCount = cities?.length;

  function openCountryForm(country: Country | null) {
    setSelectedCountry(country);
    setCountryFormOpen(true);
  }

  function openCurrencyForm(currency: Currency | null) {
    setSelectedCurrency(currency);
    setCurrencyFormOpen(true);
  }

  const tabs: TabItem[] = [
    { id: 'countries', label: 'Pays', icon: <IconWorld size={16} />, count: countries ? sortedCountries.length : undefined },
    { id: 'cities', label: 'Villes', icon: <IconMapPin size={16} />, count: citiesCount },
    { id: 'currencies', label: 'Devises', icon: <IconCoin size={16} />, count: currencies ? currencies.length : undefined },
  ];

  const heroStats: HeroStat[] = [
    {
      id: 'countries',
      icon: <IconWorld size={18} />,
      value: countries ? String(sortedCountries.length) : '…',
      label: 'Pays',
      sublabel: countries ? `${activeCountries} ${plural(activeCountries, 'actif')}` : undefined,
    },
    {
      id: 'cities',
      icon: <IconMapPin size={18} />,
      value: citiesCount !== undefined ? String(citiesCount) : '…',
      label: 'Villes',
      sublabel: selectedCityCountry?.name,
    },
    {
      id: 'currencies',
      icon: <IconCoin size={18} />,
      value: currencies ? String(currencies.length) : '…',
      label: 'Devises',
      sublabel: currencies?.map((currency) => currency.isoCode).join(' · '),
    },
  ];

  return (
    <div className="space-y-5">
      <Hero stats={heroStats} onSelectTab={setTab} />

      <TabBar active={tab} items={tabs} onChange={setTab} />

      {tab === 'countries' ? (
        <CountriesTab
          countries={sortedCountries}
          currencies={currencies ?? []}
          isLoading={countriesLoading}
          onSelectCountry={openCountryForm}
          onAddCountry={() => openCountryForm(null)}
        />
      ) : null}

      {tab === 'cities' ? (
        <CitiesTab
          countries={sortedCountries}
          countryId={countryId}
          onCountryChange={setCountryId}
          cities={cities ?? []}
          isLoading={citiesLoading}
          onAddCity={() => setCityModalState({ mode: 'create' })}
          onEditCity={(city) => setCityModalState({ mode: 'edit', city })}
          onGoToCountries={() => setTab('countries')}
        />
      ) : null}

      {tab === 'currencies' ? (
        <CurrenciesTab
          currencies={currencies ?? []}
          isLoading={currenciesLoading}
          onSelectCurrency={openCurrencyForm}
          onAddCurrency={() => openCurrencyForm(null)}
        />
      ) : null}

      <CountryFormModal
        open={countryFormOpen}
        onClose={() => setCountryFormOpen(false)}
        country={selectedCountry}
        currencies={currencies ?? []}
      />
      <CurrencyFormModal open={currencyFormOpen} onClose={() => setCurrencyFormOpen(false)} currency={selectedCurrency} />
      <CityFormModal
        open={cityModalState !== null}
        onClose={() => setCityModalState(null)}
        city={cityModalState?.mode === 'edit' ? cityModalState.city : null}
        countryId={countryId}
        countryName={selectedCityCountry?.name ?? ''}
      />
    </div>
  );
}