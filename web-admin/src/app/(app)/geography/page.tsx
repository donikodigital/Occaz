// web-admin/src/app/(app)/geography/page.tsx
'use client';

import React, { useState } from 'react';
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
} from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';

function CountriesSection() {
  const { data: countries, isLoading } = useCountries();
  const createCountry = useCreateCountry();
  const [isoCode, setIsoCode] = useState('');
  const [name, setName] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [crossBorder, setCrossBorder] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

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
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">Pays</h2>
      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Chargement…</p>
        ) : (
          (countries ?? []).map((country) => <Badge key={country.id} label={`${country.name} (${country.isoCode})`} tone="neutral" />)
        )}
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
    </div>
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
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">Devises</h2>
      <div className="flex flex-wrap gap-2">
        {isLoading ? (
          <p className="text-sm text-text-secondary">Chargement…</p>
        ) : (
          (currencies ?? []).map((currency) => <Badge key={currency.id} label={`${currency.name} (${currency.isoCode})`} tone="neutral" />)
        )}
      </div>
      <Card>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
    </div>
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
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-text-primary">Régions, préfectures et villes</h2>
      <Select label="Pays" value={countryId} onChange={(e) => { setCountryId(e.target.value); setRegionId(''); }} className="max-w-xs">
        <option value="">Choisir un pays…</option>
        {(countries ?? []).map((country) => (
          <option key={country.id} value={country.id}>
            {country.name}
          </option>
        ))}
      </Select>

      {countryId ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="space-y-3">
            <h3 className="text-sm font-semibold text-text-secondary">Régions</h3>
            {regionsLoading ? (
              <p className="text-sm text-text-secondary">Chargement…</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(regions ?? []).map((region) => (
                  <button
                    key={region.id}
                    onClick={() => setRegionId(region.id)}
                    className={`rounded-full px-3 py-1 text-xs ${region.id === regionId ? 'bg-primary text-on-primary' : 'bg-surface-muted text-text-primary'}`}
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

          <Card className="space-y-3">
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
        <Card className="space-y-3">
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
    </div>
  );
}

export default function GeographyPage() {
  return (
    <div className="space-y-10">
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
