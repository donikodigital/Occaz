// web-admin/src/app/(app)/geography/page.tsx
'use client';

import React, { useState } from 'react';
import { IconCoin, IconMapPin, IconWorld } from '@tabler/icons-react';
import {
  Badge,
  Button,
  Card,
  Select,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
  TextField,
} from '@/components/ui';
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

function SectionHeader({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        {icon}
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary">{title}</h2>
        {description ? <p className="text-sm text-text-secondary">{description}</p> : null}
      </div>
    </div>
  );
}

/**
 * Le select de devise par défaut est un <select> natif stylé à la main
 * plutôt que le composant Select (qui impose un label au-dessus) — ici
 * l'en-tête de colonne du tableau fait déjà office de label, un label
 * répété par ligne aurait surchargé le tableau.
 */
function CountryRow({ country, currencies }: { country: Country; currencies: Currency[] }) {
  const updateCountry = useUpdateCountry();
  const missingCurrency = !country.defaultCurrencyId;

  return (
    <TableRow className={missingCurrency ? 'bg-danger-light/40' : undefined}>
      <TableCell className="font-medium">{country.name}</TableCell>
      <TableCell>
        <Badge label={country.isoCode} tone="neutral" />
      </TableCell>
      <TableCell>{country.phoneCode}</TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={country.defaultCurrencyId ?? ''}
            disabled={updateCountry.isPending}
            onChange={(e) =>
              updateCountry.mutate({ id: country.id, defaultCurrencyId: e.target.value || null })
            }
            className="rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
          >
            <option value="">— Aucune —</option>
            {currencies.map((currency) => (
              <option key={currency.id} value={currency.id}>
                {currency.name} ({currency.isoCode})
              </option>
            ))}
          </select>
          {missingCurrency ? <Badge label="Devise manquante" tone="danger" /> : null}
        </div>
      </TableCell>
      <TableCell>
        <Badge
          label={country.isCrossBorderEnabled ? 'Oui' : 'Non'}
          tone={country.isCrossBorderEnabled ? 'success' : 'neutral'}
        />
      </TableCell>
    </TableRow>
  );
}

function CountriesSection() {
  const { data: countries, isLoading } = useCountries();
  const { data: currencies } = useCurrencies();
  const createCountry = useCreateCountry();
  const [isoCode, setIsoCode] = useState('');
  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [crossBorder, setCrossBorder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const missingCount = (countries ?? []).filter((c) => !c.defaultCurrencyId).length;

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
      />

      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Pays</TableHeaderCell>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Indicatif</TableHeaderCell>
              <TableHeaderCell>Devise par défaut</TableHeaderCell>
              <TableHeaderCell>Transfrontalier</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(countries ?? []).map((country) => (
              <CountryRow key={country.id} country={country} currencies={currencies ?? []} />
            ))}
          </TableBody>
        </Table>
      )}

      <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-4">
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
    </Card>
  );
}

function CurrenciesSection() {
  const { data: currencies, isLoading } = useCurrencies();
  const createCurrency = useCreateCurrency();
  const [isoCode, setIsoCode] = useState('');
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

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
      <SectionHeader icon={<IconCoin size={18} />} title="Devises" description="Utilisées pour les pays, les tarifs et les portefeuilles." />

      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableHeaderCell>Code</TableHeaderCell>
              <TableHeaderCell>Nom</TableHeaderCell>
              <TableHeaderCell>Symbole</TableHeaderCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(currencies ?? []).map((currency) => (
              <TableRow key={currency.id}>
                <TableCell>
                  <Badge label={currency.isoCode} tone="neutral" />
                </TableCell>
                <TableCell className="font-medium">{currency.name}</TableCell>
                <TableCell>{currency.symbol ?? '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-5 sm:grid-cols-3">
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
            {country.name}
          </option>
        ))}
      </Select>

      {countryId ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card padded className="bg-surface-muted/40 space-y-3">
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
                      region.id === regionId ? 'bg-primary text-on-primary' : 'bg-surface text-text-primary border border-border hover:bg-surface-muted'
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

          <Card padded className="bg-surface-muted/40 space-y-3">
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
        <Card padded className="mt-4 bg-surface-muted/40 space-y-3">
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
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Géographie</h1>
        <p className="text-sm text-text-secondary">Réglage ponctuel — pays, devises, et divisions administratives.</p>
      </div>
      <CountriesSection />
      <CurrenciesSection />
      <AdministrativeDivisionsSection />
    </div>
  );
}