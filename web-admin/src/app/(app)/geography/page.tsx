// web-admin/src/app/(app)/geography/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { IconCoin, IconMapPin, IconPlus, IconSearch, IconWorld } from '@tabler/icons-react';
import { Badge, Button, Card, Select, Switch, TextField } from '@/components/ui';
import {
  useCities,
  useCountries,
  useCreateCity,
  useCreateCountry,
  useCreateCurrency,
  useCreatePrefecture,
  useCreateRegion,
  useCurrencies,
  usePrefectures,
  useRegions,
  useUpdateCountry,
} from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';
import type { Country, Currency } from '@/types/geography.types';

/**
 * Emoji drapeau à partir d'un code ISO 3166-1 alpha-2, via les symboles
 * indicateurs régionaux Unicode — aucune dépendance, mais le rendu
 * dépend de la police système. Sur Windows 11 récent et la plupart des
 * navigateurs mobiles, s'affiche comme un vrai drapeau ; sur un système
 * plus ancien, peut apparaître comme deux lettres dans un petit cadre
 * (limite de la police système, pas un bug).
 */
function isoToFlagEmoji(isoCode: string): string {
  if (!/^[A-Za-z]{2}$/.test(isoCode)) return '🏳️';
  return isoCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

function SectionHeader({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold text-text-primary">{title}</h2>
          {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );
}

function SearchField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mb-3">
      <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-surface py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
    </div>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-3.5 py-2">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-semibold text-text-primary">{value}</p>
    </div>
  );
}

/**
 * Le select de devise par défaut est un <select> natif stylé à la main
 * plutôt que le composant Select (qui impose un label au-dessus) — ici
 * la ligne fait déjà office de label, un label répété par ligne aurait
 * surchargé la liste.
 */
function CountryRow({ country, currencies }: { country: Country; currencies: Currency[] }) {
  const updateCountry = useUpdateCountry();
  const missingCurrency = !country.defaultCurrencyId;

  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/40 ${missingCurrency ? 'bg-danger-light/30' : ''}`}>
      <span className="text-2xl leading-none" aria-hidden="true">
        {isoToFlagEmoji(country.isoCode)}
      </span>
      <div className="min-w-[150px] flex-1">
        <p className="font-medium text-text-primary">{country.name}</p>
        <p className="text-xs text-text-secondary">
          {country.isoCode} · {country.phoneCode}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={country.defaultCurrencyId ?? ''}
          disabled={updateCountry.isPending}
          onChange={(e) =>
            updateCountry.mutate({ id: country.id, defaultCurrencyId: e.target.value || null })
          }
          className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
        >
          <option value="">— Aucune devise —</option>
          {currencies.map((currency) => (
            <option key={currency.id} value={currency.id}>
              {currency.name} ({currency.isoCode})
            </option>
          ))}
        </select>
        {missingCurrency ? <Badge label="Devise manquante" tone="danger" /> : null}
        <Badge
          label={country.isCrossBorderEnabled ? 'Transfrontalier' : 'Non transfrontalier'}
          tone={country.isCrossBorderEnabled ? 'success' : 'neutral'}
        />
      </div>
    </div>
  );
}

function CountriesSection() {
  const { data: countries, isLoading } = useCountries();
  const { data: currencies } = useCurrencies();
  const createCountry = useCreateCountry();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isoCode, setIsoCode] = useState('');
  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [crossBorder, setCrossBorder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const missingCount = (countries ?? []).filter((c) => !c.defaultCurrencyId).length;
  const filteredCountries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return countries ?? [];
    return (countries ?? []).filter(
      (c) => c.name.toLowerCase().includes(query) || c.isoCode.toLowerCase().includes(query),
    );
  }, [countries, search]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      await createCountry.mutateAsync({
        isoCode: isoCode.toUpperCase(),
        name,
        phoneCode,
        isCrossBorderEnabled: crossBorder,
      });
      setIsoCode('');
      setName('');
      setPhoneCode('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <Card className="animate-in">
      <SectionHeader
        icon={<IconWorld size={18} />}
        title="Pays"
        description={
          missingCount > 0
            ? `${missingCount} pays sans devise par défaut — le portefeuille des chauffeurs concernés ne peut pas être créé.`
            : 'Tous les pays ont une devise par défaut configurée.'
        }
        action={
          <Button type="button" onClick={() => setShowForm((v) => !v)} className="shrink-0">
            <IconPlus size={16} />
            {showForm ? 'Fermer' : 'Ajouter un pays'}
          </Button>
        }
      />

      {showForm ? (
        <form onSubmit={handleSubmit} className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-muted/30 p-4 sm:grid-cols-4">
          <TextField label="Code ISO" value={isoCode} onChange={(e) => setIsoCode(e.target.value)} placeholder="GN" maxLength={2} />
          <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guinée" />
          <TextField label="Indicatif" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} placeholder="+224" />
          <div className="flex items-end">
            <Switch checked={crossBorder} onChange={setCrossBorder} label="Transfrontalier" />
          </div>
          <div className="col-span-2 sm:col-span-4">
            {errorMessage ? <p className="mb-2 text-sm text-danger">{errorMessage}</p> : null}
            <Button type="submit" loading={createCountry.isPending}>
              Ajouter le pays
            </Button>
          </div>
        </form>
      ) : null}

      {(countries?.length ?? 0) > 5 ? (
        <SearchField value={search} onChange={setSearch} placeholder="Rechercher un pays…" />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : filteredCountries.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Aucun pays ne correspond à cette recherche.</p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {filteredCountries.map((country) => (
            <CountryRow key={country.id} country={country} currencies={currencies ?? []} />
          ))}
        </div>
      )}
    </Card>
  );
}

function CurrenciesSection() {
  const { data: currencies, isLoading } = useCurrencies();
  const createCurrency = useCreateCurrency();
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [isoCode, setIsoCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const filteredCurrencies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return currencies ?? [];
    return (currencies ?? []).filter(
      (c) => c.name.toLowerCase().includes(query) || c.isoCode.toLowerCase().includes(query),
    );
  }, [currencies, search]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    try {
      await createCurrency.mutateAsync({ isoCode: isoCode.toUpperCase(), name, symbol: symbol || undefined, decimalDigits: 0 });
      setIsoCode('');
      setName('');
      setSymbol('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  return (
    <Card className="animate-in">
      <SectionHeader
        icon={<IconCoin size={18} />}
        title="Devises"
        description="Utilisées pour les pays, les tarifs et les portefeuilles."
        action={
          <Button type="button" onClick={() => setShowForm((v) => !v)} className="shrink-0">
            <IconPlus size={16} />
            {showForm ? 'Fermer' : 'Ajouter une devise'}
          </Button>
        }
      />

      {showForm ? (
        <form onSubmit={handleSubmit} className="mb-5 grid grid-cols-2 gap-3 rounded-xl border border-border bg-surface-muted/30 p-4 sm:grid-cols-3">
          <TextField label="Code ISO" value={isoCode} onChange={(e) => setIsoCode(e.target.value)} placeholder="GNF" maxLength={3} />
          <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Franc guinéen" />
          <TextField label="Symbole (optionnel)" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="FG" />
          <div className="col-span-2 sm:col-span-3">
            {errorMessage ? <p className="mb-2 text-sm text-danger">{errorMessage}</p> : null}
            <Button type="submit" loading={createCurrency.isPending}>
              Ajouter la devise
            </Button>
          </div>
        </form>
      ) : null}

      {(currencies?.length ?? 0) > 5 ? (
        <SearchField value={search} onChange={setSearch} placeholder="Rechercher une devise…" />
      ) : null}

      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : filteredCurrencies.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Aucune devise ne correspond à cette recherche.</p>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
          {filteredCurrencies.map((currency) => (
            <div key={currency.id} className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted/40">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
                <IconCoin size={16} />
              </div>
              <div className="min-w-[150px] flex-1">
                <p className="font-medium text-text-primary">{currency.name}</p>
                <p className="text-xs text-text-secondary">{currency.symbol ?? '—'}</p>
              </div>
              <Badge label={currency.isoCode} tone="neutral" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function AdministrativeDivisionsSection() {
  const { data: countries } = useCountries();
  const [countryId, setCountryId] = useState('');
  const [regionId, setRegionId] = useState('');

  const { data: regions, isLoading: regionsLoading } = useRegions(countryId || undefined);
  const { data: prefectures, isLoading: prefecturesLoading } = usePrefectures(regionId || undefined);
  const { data: cities, isLoading: citiesLoading } = useCities(countryId || undefined);

  const createRegion = useCreateRegion();
  const createPrefecture = useCreatePrefecture();
  const createCity = useCreateCity();

  const [regionName, setRegionName] = useState('');
  const [prefectureName, setPrefectureName] = useState('');
  const [cityName, setCityName] = useState('');
  const [cityPrefectureId, setCityPrefectureId] = useState('');

  return (
    <Card className="animate-in">
      <SectionHeader icon={<IconMapPin size={18} />} title="Régions, préfectures et villes" />

      <Select label="Pays" value={countryId} onChange={(e) => { setCountryId(e.target.value); setRegionId(''); }} className="max-w-xs">
        <option value="">Choisir un pays…</option>
        {(countries ?? []).map((country) => (
          <option key={country.id} value={country.id}>
            {isoToFlagEmoji(country.isoCode)} {country.name}
          </option>
        ))}
      </Select>

      {countryId ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card padded className="space-y-3 bg-surface-muted/40">
            <h3 className="text-sm font-semibold text-text-secondary">Régions</h3>
            {regionsLoading ? (
              <p className="text-sm text-text-secondary">Chargement…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(regions ?? []).map((region) => (
                  <button
                    key={region.id}
                    onClick={() => setRegionId(region.id)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      region.id === regionId ? 'bg-primary text-on-primary' : 'border border-border bg-surface text-text-primary hover:bg-surface-muted'
                    }`}
                  >
                    {region.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <TextField value={regionName} onChange={(e) => setRegionName(e.target.value)} placeholder="Nouvelle région" />
              <Button
                className="px-3"
                loading={createRegion.isPending}
                disabled={!regionName.trim()}
                onClick={() => {
                  createRegion.mutate({ countryId, name: regionName.trim() });
                  setRegionName('');
                }}
              >
                Ajouter
              </Button>
            </div>
          </Card>

          <Card padded className="space-y-3 bg-surface-muted/40">
            <h3 className="text-sm font-semibold text-text-secondary">Préfectures {regionId ? '' : '(choisir une région)'}</h3>
            {regionId ? (
              <>
                {prefecturesLoading ? (
                  <p className="text-sm text-text-secondary">Chargement…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(prefectures ?? []).map((prefecture) => (
                      <Badge key={prefecture.id} label={prefecture.name} tone="neutral" />
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <TextField value={prefectureName} onChange={(e) => setPrefectureName(e.target.value)} placeholder="Nouvelle préfecture" />
                  <Button
                    className="px-3"
                    loading={createPrefecture.isPending}
                    disabled={!prefectureName.trim()}
                    onClick={() => {
                      createPrefecture.mutate({ regionId, name: prefectureName.trim() });
                      setPrefectureName('');
                    }}
                  >
                    Ajouter
                  </Button>
                </div>
              </>
            ) : null}
          </Card>
        </div>
      ) : null}

      {countryId ? (
        <Card padded className="mt-4 space-y-3 bg-surface-muted/40">
          <h3 className="text-sm font-semibold text-text-secondary">Villes</h3>
          {citiesLoading ? (
            <p className="text-sm text-text-secondary">Chargement…</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {(cities ?? []).map((city) => (
                <Badge key={city.id} label={city.name} tone="neutral" />
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <TextField label="Nouvelle ville" value={cityName} onChange={(e) => setCityName(e.target.value)} />
            <Select label="Préfecture (optionnel)" value={cityPrefectureId} onChange={(e) => setCityPrefectureId(e.target.value)} className="max-w-[200px]">
              <option value="">Aucune</option>
              {(prefectures ?? []).map((prefecture) => (
                <option key={prefecture.id} value={prefecture.id}>
                  {prefecture.name}
                </option>
              ))}
            </Select>
            <Button
              loading={createCity.isPending}
              disabled={!cityName.trim()}
              onClick={() => {
                createCity.mutate({ countryId, name: cityName.trim(), prefectureId: cityPrefectureId || undefined });
                setCityName('');
              }}
            >
              Ajouter
            </Button>
          </div>
        </Card>
      ) : null}
    </Card>
  );
}

export default function GeographyPage() {
  const { data: countries } = useCountries();
  const { data: currencies } = useCurrencies();
  const activeCountries = (countries ?? []).filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Géographie</h1>
        <p className="text-sm text-text-secondary">Réglage ponctuel — pays, devises, et divisions administratives.</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <StatPill label="Pays" value={countries ? `${countries.length} (${activeCountries} actifs)` : '…'} />
        <StatPill label="Devises" value={currencies ? String(currencies.length) : '…'} />
      </div>

      <CountriesSection />
      <CurrenciesSection />
      <AdministrativeDivisionsSection />
    </div>
  );
}