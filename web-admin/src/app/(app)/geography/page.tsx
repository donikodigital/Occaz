// web-admin/src/app/(app)/geography/page.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  IconActivity,
  IconChevronRight,
  IconCoin,
  IconMapPin,
  IconPlus,
  IconSearch,
  IconTrash,
  IconWorld,
} from '@tabler/icons-react';
import {
  Badge,
  Button,
  Card,
  Disclosure,
  EntityAvatar,
  EntityListCard,
  Modal,
  Select,
  Switch,
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
  useDeactivateCountry,
  useDeleteCity,
  useDeleteCurrency,
  usePrefectures,
  usePrefecturesByRegions,
  useRegions,
  useUpdateCity,
  useUpdateCountry,
  useUpdateCurrency,
} from '@/hooks/useGeography';
import { ApiError } from '@/services/api/ApiError';
import type { City, Country, Currency, Prefecture, Region } from '@/types/geography.types';
import { RegionFormModal } from '@/components/geography/RegionFormModal';
import { PrefectureFormModal } from '@/components/geography/PrefectureFormModal';
import { GeoEntityList } from '@/components/geography/GeoEntityList';

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

/** Carte compacte cliquable — les 3 doivent tenir sur une seule ligne même sur mobile étroit. */
function StatCard({
  icon,
  label,
  value,
  sublabel,
  onClick,
  tone = 'primary',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
  onClick?: () => void;
  tone?: 'primary' | 'success' | 'accent';
}) {
  const toneClasses: Record<'primary' | 'success' | 'accent', string> = {
    primary: 'bg-primary-light text-primary',
    success: 'bg-success-light text-success-dark',
    accent: 'bg-accent-light text-accent-dark',
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-start gap-1.5 rounded-xl border border-border bg-surface p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary-light/20 sm:p-4"
    >
      <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${toneClasses[tone]}`}>{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-wide text-text-secondary sm:text-xs">{label}</span>
      <span className="text-lg font-bold text-text-primary sm:text-xl">{value}</span>
      {sublabel ? <span className="truncate text-[11px] text-text-muted sm:text-xs">{sublabel}</span> : null}
    </button>
  );
}

function CountryCard({ country, currencies, onClick }: { country: Country; currencies: Currency[]; onClick: () => void }) {
  const currency = currencies.find((c) => c.id === country.defaultCurrencyId);
  const missingCurrency = !country.defaultCurrencyId;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-primary-light/20 ${
        missingCurrency ? 'border-danger-light bg-danger-light/20' : 'border-border bg-surface'
      }`}
    >
      <span className="text-3xl leading-none" aria-hidden="true">
        {isoToFlagEmoji(country.isoCode)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{country.name}</p>
        <p className="text-xs text-text-secondary">
          {country.isoCode} · {country.phoneCode}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {!country.isActive ? <Badge label="Désactivé" tone="neutral" /> : null}
          {missingCurrency ? (
            <Badge label="Devise manquante" tone="danger" />
          ) : (
            <Badge label={currency?.isoCode ?? '—'} tone="primary" />
          )}
          <Badge
            label={country.isCrossBorderEnabled ? 'Transfrontalier' : 'Non transfrontalier'}
            tone={country.isCrossBorderEnabled ? 'success' : 'neutral'}
          />
        </div>
      </div>
      <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function CurrencyCard({ currency, onClick }: { currency: Currency; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-xl border border-border bg-surface p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-primary-light/20"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-light text-primary">
        <IconCoin size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{currency.name}</p>
        <p className="text-xs text-text-secondary">{currency.symbol ?? '—'}</p>
      </div>
      <Badge label={currency.isoCode} tone="neutral" />
      <IconChevronRight size={18} className="shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function StatusGroup({
  label,
  tone,
  countries,
  onSelect,
}: {
  label: string;
  tone: 'success' | 'neutral';
  countries: Country[];
  onSelect: (country: Country) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Badge label={label} tone={tone} />
        <span className="text-xs text-text-muted">{countries.length}</span>
      </div>
      {countries.length === 0 ? (
        <p className="text-sm text-text-muted">Aucun pays.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {countries.map((country) => (
            <button
              key={country.id}
              type="button"
              onClick={() => onSelect(country)}
              className="flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-text-primary transition-colors hover:border-primary/40 hover:bg-primary-light/20"
            >
              <span aria-hidden="true">{isoToFlagEmoji(country.isoCode)}</span>
              {country.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusesModal({
  open,
  onClose,
  countries,
  onSelectCountry,
}: {
  open: boolean;
  onClose: () => void;
  countries: Country[];
  onSelectCountry: (country: Country) => void;
}) {
  const active = countries.filter((c) => c.isActive);
  const inactive = countries.filter((c) => !c.isActive);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Statuts des pays"
      description={`${active.length} actif${active.length > 1 ? 's' : ''} · ${inactive.length} désactivé${inactive.length > 1 ? 's' : ''}`}
    >
      <div className="space-y-5">
        <StatusGroup label="Actifs" tone="success" countries={active} onSelect={onSelectCountry} />
        <StatusGroup label="Désactivés" tone="neutral" countries={inactive} onSelect={onSelectCountry} />
      </div>
    </Modal>
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
      title={country ? country.name : 'Ajouter un pays'}
      description={country ? `${isoToFlagEmoji(country.isoCode)} ${country.isoCode} · ${country.phoneCode}` : undefined}
      zIndex={60}
      footer={
        <>
          {country && country.isActive ? (
            confirmingDeactivate ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-light/40 px-3 py-2">
                <span className="text-sm text-danger-dark">Désactiver ce pays ?</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmingDeactivate(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" loading={deactivateCountry.isPending} onClick={handleDeactivate}>
                    Confirmer
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDeactivate(true)} className="mr-auto">
                <IconTrash size={16} />
                Supprimer
              </Button>
            )
          ) : null}
          {!confirmingDeactivate ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" form="country-form" loading={saving}>
                {country ? 'Enregistrer' : 'Créer le pays'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <form id="country-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Code ISO" value={isoCode} onChange={(e) => setIsoCode(e.target.value)} placeholder="GN" maxLength={2} required />
          <TextField label="Indicatif" value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} placeholder="+224" required />
        </div>
        <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Guinée" required />
        <Select label="Devise par défaut" value={defaultCurrencyId} onChange={(e) => setDefaultCurrencyId(e.target.value)}>
          <option value="">— Aucune devise —</option>
          {currencies.map((currency) => (
            <option key={currency.id} value={currency.id}>
              {currency.name} ({currency.isoCode})
            </option>
          ))}
        </Select>
        <Switch checked={isCrossBorderEnabled} onChange={setIsCrossBorderEnabled} label="Transfrontalier" />
        {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currency ? currency.name : 'Ajouter une devise'}
      description={currency ? currency.isoCode : undefined}
      zIndex={60}
      footer={
        <>
          {currency ? (
            confirmingDelete ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-light/40 px-3 py-2">
                <span className="text-sm text-danger-dark">Supprimer cette devise ?</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" loading={deleteCurrency.isPending} onClick={handleDelete}>
                    Confirmer
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)} className="mr-auto">
                <IconTrash size={16} />
                Supprimer
              </Button>
            )
          ) : null}
          {!confirmingDelete ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" form="currency-form" loading={saving}>
                {currency ? 'Enregistrer' : 'Créer la devise'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <form id="currency-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Code ISO" value={isoCode} onChange={(e) => setIsoCode(e.target.value)} placeholder="GNF" maxLength={3} required />
          <TextField label="Symbole (optionnel)" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="FG" />
        </div>
        <TextField label="Nom" value={name} onChange={(e) => setName(e.target.value)} placeholder="Franc guinéen" required />
        <TextField
          label="Décimales"
          type="number"
          min={0}
          value={decimalDigits}
          onChange={(e) => setDecimalDigits(Number(e.target.value))}
          hint="0 pour GNF/XOF (pas de sous-unité)"
        />
        {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
      </form>
    </Modal>
  );
}

function CountriesPanel({
  id,
  countries,
  currencies,
  isLoading,
  onSelectCountry,
  onAddCountry,
}: {
  id: string;
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
    <Card id={id} className="animate-in scroll-mt-4">
      <SectionHeader
        icon={<IconWorld size={18} />}
        title="Pays"
        description={missingCount > 0 ? `${missingCount} pays sans devise par défaut` : 'Tous les pays ont une devise configurée.'}
        action={
          <Button type="button" onClick={onAddCountry} className="shrink-0">
            <IconPlus size={16} />
            Ajouter un pays
          </Button>
        }
      />
      {countries.length > 5 ? <SearchField value={search} onChange={setSearch} placeholder="Rechercher un pays…" /> : null}
      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Aucun pays ne correspond à cette recherche.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((country) => (
            <CountryCard key={country.id} country={country} currencies={currencies} onClick={() => onSelectCountry(country)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function CurrenciesPanel({
  id,
  currencies,
  isLoading,
  onSelectCurrency,
  onAddCurrency,
}: {
  id: string;
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
    <Card id={id} className="animate-in scroll-mt-4">
      <SectionHeader
        icon={<IconCoin size={18} />}
        title="Devises"
        description="Utilisées pour les pays, les tarifs et les portefeuilles."
        action={
          <Button type="button" onClick={onAddCurrency} className="shrink-0">
            <IconPlus size={16} />
            Ajouter une devise
          </Button>
        }
      />
      {currencies.length > 5 ? <SearchField value={search} onChange={setSearch} placeholder="Rechercher une devise…" /> : null}
      {isLoading ? (
        <p className="text-sm text-text-secondary">Chargement…</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-text-muted">Aucune devise ne correspond à cette recherche.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {filtered.map((currency) => (
            <CurrencyCard key={currency.id} currency={currency} onClick={() => onSelectCurrency(currency)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function CityFormModal({
  open,
  onClose,
  city,
  countryId,
  regions,
  prefecturesById,
  initialRegionId,
  initialPrefectureId,
}: {
  open: boolean;
  onClose: () => void;
  city: City | null;
  countryId: string;
  regions: Region[];
  prefecturesById: Map<string, { name: string; regionId: string; regionName: string }>;
  /** Pré-remplissage à la création uniquement (ex. depuis le tiroir Villes, où une région/préfecture est déjà sélectionnée) — ignoré en édition. */
  initialRegionId?: string;
  initialPrefectureId?: string;
}) {
  const [regionId, setRegionId] = useState('');
  const [prefectureId, setPrefectureId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [newRegionName, setNewRegionName] = useState('');
  const [newPrefectureName, setNewPrefectureName] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const { data: prefectures } = usePrefectures(regionId || undefined);
  const createRegion = useCreateRegion();
  const createPrefecture = useCreatePrefecture();
  const createCity = useCreateCity();
  const updateCity = useUpdateCity(countryId);
  const deleteCity = useDeleteCity(countryId);

  useEffect(() => {
    if (!open) return;
    if (city) {
      const prefecture = city.prefectureId ? prefecturesById.get(city.prefectureId) : undefined;
      setRegionId(prefecture?.regionId ?? '');
      setPrefectureId(city.prefectureId ?? '');
      setName(city.name);
      setAddress(city.address ?? '');
    } else {
      setRegionId(initialRegionId ?? '');
      setPrefectureId(initialPrefectureId ?? '');
      setName('');
      setAddress('');
    }
    setNewRegionName('');
    setNewPrefectureName('');
    setConfirmingDelete(false);
    setErrorMessage(undefined);
  }, [open, city, prefecturesById, initialRegionId, initialPrefectureId]);

  async function handleCreateRegion() {
    if (!newRegionName.trim()) return;
    setErrorMessage(undefined);
    try {
      const region = await createRegion.mutateAsync({ countryId, name: newRegionName.trim() });
      setRegionId(region.id);
      setPrefectureId('');
      setNewRegionName('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleCreatePrefecture() {
    if (!newPrefectureName.trim() || !regionId) return;
    setErrorMessage(undefined);
    try {
      const prefecture = await createPrefecture.mutateAsync({ regionId, name: newPrefectureName.trim() });
      setPrefectureId(prefecture.id);
      setNewPrefectureName('');
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : 'Une erreur est survenue.');
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(undefined);
    const payload = {
      countryId,
      prefectureId: prefectureId || undefined,
      name: name.trim(),
      address: address.trim() || undefined,
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={city ? city.name : 'Ajouter une ville'}
      zIndex={60}
      footer={
        <>
          {city ? (
            confirmingDelete ? (
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 rounded-lg bg-danger-light/40 px-3 py-2">
                <span className="text-sm text-danger-dark">Supprimer cette ville ?</span>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setConfirmingDelete(false)}>
                    Annuler
                  </Button>
                  <Button variant="danger" loading={deleteCity.isPending} onClick={handleDelete}>
                    Confirmer
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="danger" onClick={() => setConfirmingDelete(true)} className="mr-auto">
                <IconTrash size={16} />
                Supprimer
              </Button>
            )
          ) : null}
          {!confirmingDelete ? (
            <>
              <Button variant="ghost" onClick={onClose}>
                Fermer
              </Button>
              <Button type="submit" form="city-form" loading={saving} disabled={!name.trim()}>
                {city ? 'Enregistrer' : 'Créer la ville'}
              </Button>
            </>
          ) : null}
        </>
      }
    >
      <form id="city-form" onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Select
            label="Région (optionnel)"
            value={regionId}
            onChange={(e) => {
              setRegionId(e.target.value);
              setPrefectureId('');
            }}
          >
            <option value="">— Aucune —</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </Select>
          <div className="mt-1.5 flex gap-2">
            <TextField value={newRegionName} onChange={(e) => setNewRegionName(e.target.value)} placeholder="Nouvelle région…" />
            <Button
              type="button"
              variant="secondary"
              className="px-3"
              loading={createRegion.isPending}
              disabled={!newRegionName.trim()}
              onClick={handleCreateRegion}
            >
              <IconPlus size={14} />
            </Button>
          </div>
        </div>

        <div>
          <Select label="Préfecture (optionnel)" value={prefectureId} onChange={(e) => setPrefectureId(e.target.value)} disabled={!regionId}>
            <option value="">— Aucune —</option>
            {(prefectures ?? []).map((prefecture) => (
              <option key={prefecture.id} value={prefecture.id}>
                {prefecture.name}
              </option>
            ))}
          </Select>
          {regionId ? (
            <div className="mt-1.5 flex gap-2">
              <TextField value={newPrefectureName} onChange={(e) => setNewPrefectureName(e.target.value)} placeholder="Nouvelle préfecture…" />
              <Button
                type="button"
                variant="secondary"
                className="px-3"
                loading={createPrefecture.isPending}
                disabled={!newPrefectureName.trim()}
                onClick={handleCreatePrefecture}
              >
                <IconPlus size={14} />
              </Button>
            </div>
          ) : null}
        </div>

        <TextField label="Nom de la ville" value={name} onChange={(e) => setName(e.target.value)} placeholder="Labé" required />
        <TextField
          label="Adresse (optionnel)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Quartier Almamya, en face du marché"
        />

        {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}
      </form>
    </Modal>
  );
}

// Un générique multi-lignes passé directement à useState<...> commençant par
// une accolade sur une nouvelle ligne fait planter le parseur SWC/Next.js en
// .tsx (ambiguïté avec du JSX) — d'où cet alias nommé sur une seule ligne.
type CityModalState = { mode: 'create'; regionId?: string; prefectureId?: string } | { mode: 'edit'; city: City };

function LocationsPanel({ countries }: { countries: Country[] }) {
  const [countryId, setCountryId] = useState('');
  const { data: regions, isLoading: regionsLoading } = useRegions(countryId || undefined);
  const regionIds = useMemo(() => (regions ?? []).map((r) => r.id), [regions]);
  const prefectureQueries = usePrefecturesByRegions(regionIds);

  const prefecturesById = useMemo(() => {
    const map = new Map<string, { name: string; regionId: string; regionName: string }>();
    (regions ?? []).forEach((region, index) => {
      const prefectures = prefectureQueries[index]?.data ?? [];
      prefectures.forEach((prefecture) => {
        map.set(prefecture.id, { name: prefecture.name, regionId: region.id, regionName: region.name });
      });
    });
    return map;
  }, [regions, prefectureQueries]);

  const { data: cities, isLoading: citiesLoading } = useCities(countryId || undefined);

  const rows = useMemo(() => {
    return (cities ?? [])
      .map((city) => {
        const prefecture = city.prefectureId ? prefecturesById.get(city.prefectureId) : undefined;
        return { city, regionName: prefecture?.regionName ?? '—', prefectureName: prefecture?.name ?? '—' };
      })
      .sort((a, b) => a.city.name.localeCompare(b.city.name));
  }, [cities, prefecturesById]);

  // Toutes les villes du pays, triées — indépendant de la région/préfecture
  // sélectionnée ci-dessous : la plupart des villes n'ont ni région ni
  // préfecture assignée, un tiroir filtré par préfecture resterait donc
  // presque toujours vide alors que c'est la liste la plus utile.
  const allCitiesSorted = useMemo(() => {
    return [...(cities ?? [])].sort((a, b) => a.name.localeCompare(b.name));
  }, [cities]);

  const [cityModalState, setCityModalState] = useState<CityModalState | null>(null);

  // Gestion des régions et préfectures elles-mêmes (renommer/supprimer), en
  // plus de leur création à la volée depuis le formulaire ville. La
  // sélection sert uniquement à pré-remplir le formulaire d'ajout de ville,
  // plus à filtrer le tiroir Villes (voir allCitiesSorted ci-dessus).
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const { data: prefecturesForSelected, isLoading: prefecturesForSelectedLoading } = usePrefectures(selectedRegionId || undefined);
  const [selectedPrefectureId, setSelectedPrefectureId] = useState('');

  const [regionFormOpen, setRegionFormOpen] = useState(false);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [prefectureFormOpen, setPrefectureFormOpen] = useState(false);
  const [editingPrefecture, setEditingPrefecture] = useState<Prefecture | null>(null);

  useEffect(() => {
    setSelectedRegionId('');
  }, [countryId]);

  useEffect(() => {
    setSelectedPrefectureId('');
  }, [selectedRegionId]);

  return (
    <Card className="animate-in">
      <SectionHeader
        icon={<IconMapPin size={18} />}
        title="Régions, préfectures et villes"
        action={
          countryId ? (
            <Button type="button" onClick={() => setCityModalState({ mode: 'create' })} className="shrink-0">
              <IconPlus size={16} />
              Ajouter une ville
            </Button>
          ) : null
        }
      />

      <Select label="Pays" value={countryId} onChange={(e) => setCountryId(e.target.value)} className="mb-4 max-w-xs">
        <option value="">Choisir un pays…</option>
        {countries.map((country) => (
          <option key={country.id} value={country.id}>
            {isoToFlagEmoji(country.isoCode)} {country.name}
          </option>
        ))}
      </Select>

      {!countryId ? (
        <p className="py-6 text-center text-sm text-text-muted">Choisis un pays pour voir ses régions, préfectures et villes.</p>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Disclosure
              title="Régions"
              subtitle={regions ? `${regions.length}` : undefined}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1.5 text-xs"
                  onClick={() => {
                    setEditingRegion(null);
                    setRegionFormOpen(true);
                  }}
                >
                  <IconPlus size={14} />
                  Ajouter
                </Button>
              }
            >
              <GeoEntityList
                title="Régions"
                hideHeader
                items={(regions ?? []).map((r) => ({ id: r.id, name: r.name }))}
                isLoading={regionsLoading}
                emptyLabel="Aucune région pour ce pays."
                searchPlaceholder="Rechercher une région…"
                onAdd={() => {
                  setEditingRegion(null);
                  setRegionFormOpen(true);
                }}
                onEdit={(item) => {
                  const region = (regions ?? []).find((r) => r.id === item.id) ?? null;
                  setEditingRegion(region);
                  setRegionFormOpen(true);
                }}
                selectedId={selectedRegionId}
                onSelect={(item) => setSelectedRegionId(item.id)}
                helperText="Sélectionne pour pré-remplir l'ajout de ville ; crayon pour renommer/supprimer."
              />
            </Disclosure>

            <Disclosure
              title="Préfectures"
              subtitle={selectedRegionId ? (prefecturesForSelected ? `${prefecturesForSelected.length}` : undefined) : 'aucune région choisie'}
              action={
                <Button
                  type="button"
                  variant="secondary"
                  className="px-2.5 py-1.5 text-xs"
                  disabled={!selectedRegionId}
                  onClick={() => {
                    setEditingPrefecture(null);
                    setPrefectureFormOpen(true);
                  }}
                >
                  <IconPlus size={14} />
                  Ajouter
                </Button>
              }
            >
              <GeoEntityList
                title="Préfectures"
                hideHeader
                items={(prefecturesForSelected ?? []).map((p) => ({ id: p.id, name: p.name }))}
                isLoading={prefecturesForSelectedLoading}
                emptyLabel="Aucune préfecture pour cette région."
                searchPlaceholder="Rechercher une préfecture…"
                onAdd={() => {
                  setEditingPrefecture(null);
                  setPrefectureFormOpen(true);
                }}
                onEdit={(item) => {
                  const prefecture = (prefecturesForSelected ?? []).find((p) => p.id === item.id) ?? null;
                  setEditingPrefecture(prefecture);
                  setPrefectureFormOpen(true);
                }}
                selectedId={selectedPrefectureId}
                onSelect={(item) => setSelectedPrefectureId(item.id)}
                disabled={!selectedRegionId}
                disabledHint="Sélectionne une région dans le tiroir de gauche."
                helperText="Sélectionne pour pré-remplir l'ajout de ville ; crayon pour renommer/supprimer."
              />
            </Disclosure>

            <Disclosure title="Villes" subtitle={allCitiesSorted.length ? `${allCitiesSorted.length}` : undefined} defaultOpen>
              <GeoEntityList
                title="Villes"
                hideHeader
                items={allCitiesSorted.map((c) => ({ id: c.id, name: c.name }))}
                isLoading={citiesLoading}
                emptyLabel="Aucune ville enregistrée pour ce pays."
                searchPlaceholder="Rechercher une ville…"
                onAdd={() => setCityModalState({ mode: 'create', regionId: selectedRegionId, prefectureId: selectedPrefectureId })}
                onEdit={(item) => {
                  const city = allCitiesSorted.find((c) => c.id === item.id) ?? null;
                  if (city) setCityModalState({ mode: 'edit', city });
                }}
                helperText="Toutes les villes du pays. Crayon pour renommer, déplacer ou supprimer."
              />
            </Disclosure>
          </div>

          {citiesLoading ? (
            <p className="text-sm text-text-secondary">Chargement…</p>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Aucune ville enregistrée pour ce pays.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {rows.map(({ city, regionName, prefectureName }) => (
                <EntityListCard
                  key={city.id}
                  avatar={<EntityAvatar initials={city.name.slice(0, 2).toUpperCase()} tone="accent" />}
                  title={city.name}
                  subtitle={city.address ?? undefined}
                  badges={
                    <>
                      {regionName !== '—' ? <Badge label={regionName} tone="primary" /> : null}
                      {prefectureName !== '—' ? <Badge label={prefectureName} tone="neutral" /> : null}
                    </>
                  }
                  onClick={() => setCityModalState({ mode: 'edit', city })}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CityFormModal
        open={cityModalState !== null}
        onClose={() => setCityModalState(null)}
        city={cityModalState?.mode === 'edit' ? cityModalState.city : null}
        countryId={countryId}
        regions={regions ?? []}
        prefecturesById={prefecturesById}
        initialRegionId={cityModalState?.mode === 'create' ? cityModalState.regionId : undefined}
        initialPrefectureId={cityModalState?.mode === 'create' ? cityModalState.prefectureId : undefined}
      />
      <RegionFormModal open={regionFormOpen} onClose={() => setRegionFormOpen(false)} region={editingRegion} countryId={countryId} />
      <PrefectureFormModal
        open={prefectureFormOpen}
        onClose={() => setPrefectureFormOpen(false)}
        prefecture={editingPrefecture}
        regionId={selectedRegionId}
      />
    </Card>
  );
}

export default function GeographyPage() {
  const { data: countries, isLoading: countriesLoading } = useCountries();
  const { data: currencies, isLoading: currenciesLoading } = useCurrencies();

  const [statusesModalOpen, setStatusesModalOpen] = useState(false);
  const [countryFormOpen, setCountryFormOpen] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [currencyFormOpen, setCurrencyFormOpen] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState<Currency | null>(null);

  const activeCountries = (countries ?? []).filter((c) => c.isActive).length;
  const inactiveCountries = (countries ?? []).length - activeCountries;

  function openCountryForm(country: Country | null) {
    setSelectedCountry(country);
    setCountryFormOpen(true);
  }

  function openCurrencyForm(currency: Currency | null) {
    setSelectedCurrency(currency);
    setCurrencyFormOpen(true);
  }

  function scrollToPanel(panelId: string) {
    document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Géographie</h1>
        <p className="text-sm text-text-secondary">Réglage ponctuel — pays, devises, et divisions administratives.</p>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard
          icon={<IconWorld size={16} />}
          label="Pays"
          value={countries ? String(countries.length) : '…'}
          sublabel={countries ? `${activeCountries} actifs` : undefined}
          onClick={() => scrollToPanel('panel-pays')}
        />
        <StatCard
          icon={<IconActivity size={16} />}
          label="Statuts"
          value={countries ? `${activeCountries}/${inactiveCountries}` : '…'}
          sublabel="actifs / désactivés"
          tone="success"
          onClick={() => setStatusesModalOpen(true)}
        />
        <StatCard
          icon={<IconCoin size={16} />}
          label="Devises"
          value={currencies ? String(currencies.length) : '…'}
          sublabel={currencies?.map((c) => c.isoCode).join(' · ')}
          tone="accent"
          onClick={() => scrollToPanel('panel-devises')}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CountriesPanel
          id="panel-pays"
          countries={countries ?? []}
          currencies={currencies ?? []}
          isLoading={countriesLoading}
          onSelectCountry={openCountryForm}
          onAddCountry={() => openCountryForm(null)}
        />
        <CurrenciesPanel
          id="panel-devises"
          currencies={currencies ?? []}
          isLoading={currenciesLoading}
          onSelectCurrency={openCurrencyForm}
          onAddCurrency={() => openCurrencyForm(null)}
        />
      </div>

      <LocationsPanel countries={countries ?? []} />

      <StatusesModal
        open={statusesModalOpen}
        onClose={() => setStatusesModalOpen(false)}
        countries={countries ?? []}
        onSelectCountry={(country) => {
          setStatusesModalOpen(false);
          openCountryForm(country);
        }}
      />
      <CountryFormModal
        open={countryFormOpen}
        onClose={() => setCountryFormOpen(false)}
        country={selectedCountry}
        currencies={currencies ?? []}
      />
      <CurrencyFormModal open={currencyFormOpen} onClose={() => setCurrencyFormOpen(false)} currency={selectedCurrency} />
    </div>
  );
}