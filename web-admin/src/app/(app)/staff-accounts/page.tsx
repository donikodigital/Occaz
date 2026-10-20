// web-admin/src/app/(app)/staff-accounts/page.tsx
//
// [20/10/2026] v1 — « Création comptes » : le SuperAdmin crée les comptes de l'équipe (Support, Superviseur, Finance…) sans passer par
// le seed. Cartes ombrées, pas de tableau.
//  • Onglet « Créer un compte » : identité, coordonnées, rôle et pays (un ou plusieurs, ou tous). Aucun mot de passe n'est saisi ici : la
//    personne reçoit un e-mail (site, identifiant, numéro, lien personnel à usage unique) et choisit elle-même son mot de passe.
//  • Onglet « Comptes créés » : état de chaque compte (activé / en attente / invitation expirée) et renvoi de l'invitation.
// Le serveur reste l'autorité : il refuse tout autre compte que le SuperAdmin et ne laisse jamais attribuer le rôle SuperAdmin.
'use client';

import React, { useMemo, useState } from 'react';
import {
  IconCheck,
  IconClockHour4,
  IconMail,
  IconMailForward,
  IconMapPin,
  IconPhone,
  IconShieldCheck,
  IconUserCheck,
  IconUserPlus,
  IconUsers,
  IconWorld,
} from '@tabler/icons-react';
import {
  CardShell,
  Chip,
  EmptyState,
  FormError,
  IconTile,
  ListSkeleton,
  MetaItem,
  Notice,
  PageHero,
  SavedNotice,
  SectionCard,
  Tabs,
  ToggleRow,
  isoToFlagEmoji,
} from '@/components/admin/AdminUi';
import { Button, TextField } from '@/components/ui';
import { useCountries } from '@/hooks/useGeography';
import { useRoles } from '@/hooks/useRbac';
import { useCreateStaffAccount, useResendStaffInvitation, useStaffAccounts } from '@/hooks/useStaffAccounts';
import { usePermissions } from '@/hooks/usePermissions';
import { ApiError } from '@/services/api/ApiError';
import type { CreateStaffAccountResult, StaffAccount } from '@/types/staff-accounts.types';

/** Clé du rôle sans limite de droits : il ne s'attribue jamais depuis cette page (le serveur le refuse aussi). */
const SUPERADMIN_ROLE_KEY = 'superadmin';

type TabKey = 'create' | 'list';

interface FormState {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  roleId: string;
  allCountries: boolean;
  countryIds: string[];
}

const EMPTY_FORM: FormState = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  address: '',
  roleId: '',
  allCountries: false,
  countryIds: [],
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_PATTERN = /^\+\d{8,15}$/;

function validate(form: FormState): Partial<Record<keyof FormState, string>> {
  const errors: Partial<Record<keyof FormState, string>> = {};
  if (form.firstName.trim().length < 2) errors.firstName = 'Le prénom est obligatoire.';
  if (form.lastName.trim().length < 2) errors.lastName = 'Le nom est obligatoire.';
  if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Adresse e-mail invalide.';
  if (!PHONE_PATTERN.test(form.phone.replace(/[\s().-]/g, ''))) {
    errors.phone = 'Format international requis, ex. +224 620 00 00 00.';
  }
  if (!form.roleId) errors.roleId = 'Choisissez un rôle.';
  if (!form.allCountries && form.countryIds.length === 0) {
    errors.countryIds = 'Choisissez au moins un pays, ou « Tous les pays ».';
  }
  return errors;
}

function initialsOf(account: Pick<StaffAccount, 'firstName' | 'lastName' | 'email'>): string {
  const letters = `${account.firstName?.[0] ?? ''}${account.lastName?.[0] ?? ''}`.trim();
  return (letters || account.email?.[0] || '?').toUpperCase();
}

function fullNameOf(account: Pick<StaffAccount, 'firstName' | 'lastName' | 'email'>): string {
  const name = `${account.firstName ?? ''} ${account.lastName ?? ''}`.trim();
  return name || account.email || 'Compte sans nom';
}

function errorText(error: unknown): string {
  return error instanceof ApiError ? error.message : 'Une erreur est survenue. Réessayez.';
}

// ---------------------------------------------------------------------------
// Carte d'un compte
// ---------------------------------------------------------------------------

function StatusChip({ account }: { account: StaffAccount }) {
  if (account.isSuspended) return <Chip tone="danger">Suspendu</Chip>;
  if (account.status === 'ACTIVE') return <Chip tone="success" icon={<IconCheck size={13} />}>Activé</Chip>;
  if (account.status === 'INVITED') return <Chip tone="accent" icon={<IconClockHour4 size={13} />}>En attente d&apos;activation</Chip>;
  return <Chip tone="danger" icon={<IconClockHour4 size={13} />}>Invitation expirée</Chip>;
}

function AccountCard({
  account,
  onResend,
  resending,
}: {
  account: StaffAccount;
  onResend: (id: string) => void;
  resending: boolean;
}) {
  const canResend = account.status !== 'ACTIVE' && !account.isSuspended && Boolean(account.email);
  const tone = account.isSuspended ? 'danger' : account.status === 'ACTIVE' ? 'success' : account.status === 'INVITED' ? 'accent' : 'danger';

  return (
    <CardShell tone={tone} className="p-4 pl-5">
      <div className="flex items-start gap-3">
        <IconTile tone="primary" round>
          {initialsOf(account)}
        </IconTile>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-primary">{fullNameOf(account)}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
            {account.email ? <MetaItem icon={<IconMail size={14} />}>{account.email}</MetaItem> : null}
            <MetaItem icon={<IconPhone size={14} />}>{account.phone}</MetaItem>
            {account.address ? <MetaItem icon={<IconMapPin size={14} />}>{account.address}</MetaItem> : null}
          </div>
        </div>
        <StatusChip account={account} />
      </div>

      {account.roles.length > 0 ? (
        <div className="mt-3 space-y-2">
          {account.roles.map((role) => (
            <div key={role.key} className="flex flex-wrap items-center gap-1.5">
              <Chip tone="primary" icon={<IconShieldCheck size={13} />}>
                {role.name}
              </Chip>
              {role.allCountries ? (
                <Chip tone="neutral" icon={<IconWorld size={13} />}>
                  Tous les pays
                </Chip>
              ) : (
                role.countries.map((country) => (
                  <Chip key={country.id} tone="neutral">
                    {isoToFlagEmoji(country.isoCode)} {country.name}
                  </Chip>
                ))
              )}
            </div>
          ))}
        </div>
      ) : null}

      {canResend ? (
        <div className="mt-3 border-t border-border/70 pt-3">
          <Button variant="outline" loading={resending} onClick={() => onResend(account.id)} className="rounded-xl!">
            <IconMailForward size={16} />
            Renvoyer l&apos;invitation
          </Button>
        </div>
      ) : null}
    </CardShell>
  );
}

// ---------------------------------------------------------------------------
// Choix du rôle et des pays
// ---------------------------------------------------------------------------

function RoleChoice({
  name,
  description,
  selected,
  onSelect,
}: {
  name: string;
  description: string | null;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left shadow-sm transition ${
        selected ? 'border-primary bg-primary-light/60 ring-2 ring-primary/30' : 'border-border bg-surface hover:border-primary/40'
      }`}
    >
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
          selected ? 'border-primary bg-primary text-[#ffffff]' : 'border-border-strong bg-surface'
        }`}
      >
        {selected ? <IconCheck size={13} /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-text-primary">{name}</span>
        {description ? <span className="mt-0.5 block text-xs text-text-secondary">{description}</span> : null}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StaffAccountsPage() {
  const { isSuperAdmin } = usePermissions();
  const [tab, setTab] = useState<TabKey>('create');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showErrors, setShowErrors] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const [created, setCreated] = useState<CreateStaffAccountResult | null>(null);
  const [resendNotice, setResendNotice] = useState<string | undefined>();
  const [resendError, setResendError] = useState<string | undefined>();
  const [resendingId, setResendingId] = useState<string | null>(null);

  const rolesQuery = useRoles();
  const countriesQuery = useCountries();
  const accountsQuery = useStaffAccounts();
  const createMutation = useCreateStaffAccount();
  const resendMutation = useResendStaffInvitation();

  const roles = useMemo(
    () => (rolesQuery.data ?? []).filter((role) => role.key !== SUPERADMIN_ROLE_KEY).sort((a, b) => a.name.localeCompare(b.name)),
    [rolesQuery.data],
  );
  const countries = useMemo(
    () => (countriesQuery.data ?? []).filter((country) => country.isActive).sort((a, b) => a.name.localeCompare(b.name)),
    [countriesQuery.data],
  );
  const accounts = accountsQuery.data ?? [];
  const errors = validate(form);
  const activated = accounts.filter((account) => account.status === 'ACTIVE').length;
  const waiting = accounts.filter((account) => account.status !== 'ACTIVE').length;

  function patch(partial: Partial<FormState>) {
    setForm((current) => ({ ...current, ...partial }));
  }

  function toggleCountry(id: string) {
    setForm((current) => ({
      ...current,
      countryIds: current.countryIds.includes(id) ? current.countryIds.filter((value) => value !== id) : [...current.countryIds, id],
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setServerError(undefined);
    setShowErrors(true);
    if (Object.keys(errors).length > 0) return;
    try {
      const result = await createMutation.mutateAsync({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        address: form.address.trim() || undefined,
        roleId: form.roleId,
        countryIds: form.allCountries ? [] : form.countryIds,
      });
      setCreated(result);
      setForm(EMPTY_FORM);
      setShowErrors(false);
    } catch (error) {
      setServerError(errorText(error));
    }
  }

  async function handleResend(id: string) {
    setResendNotice(undefined);
    setResendError(undefined);
    setResendingId(id);
    try {
      await resendMutation.mutateAsync(id);
      setResendNotice('Invitation renvoyée : un nouveau lien, valable 7 jours, remplace le précédent.');
    } catch (error) {
      setResendError(errorText(error));
    } finally {
      setResendingId(null);
    }
  }

  if (!isSuperAdmin) {
    return (
      <Notice tone="danger">Seul le SuperAdmin peut créer les comptes de l&apos;équipe.</Notice>
    );
  }

  const fieldError = (key: keyof FormState) => (showErrors ? errors[key] : undefined);

  return (
    <div className="space-y-5">
      <PageHero
        eyebrow="Système"
        title="Création de comptes"
        description="Créez un compte Support, Superviseur ou Finance : la personne reçoit un e-mail et choisit elle-même son mot de passe."
        stats={[
          { value: String(accounts.length), label: 'Comptes équipe' },
          { value: String(activated), label: 'Activés' },
          { value: String(waiting), label: 'En attente' },
        ]}
      />

      <Tabs<TabKey>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'create', label: 'Créer un compte', icon: <IconUserPlus size={16} /> },
          { value: 'list', label: 'Comptes créés', icon: <IconUsers size={16} />, count: accounts.length },
        ]}
      />

      {tab === 'create' ? (
        <div className="space-y-4">
          {created ? (
            <div className="space-y-3">
              {created.invitationSent ? (
                <SavedNotice>
                  Compte créé pour {fullNameOf(created.account)}. Un e-mail de bienvenue vient de partir à {created.account.email} : site, identifiant, numéro
                  enregistré et lien pour choisir son mot de passe (valable 7 jours).
                </SavedNotice>
              ) : (
                <Notice>
                  Le compte de {fullNameOf(created.account)} est créé, mais l&apos;e-mail n&apos;a pas pu partir. Renvoyez l&apos;invitation depuis
                  l&apos;onglet « Comptes créés » une fois le problème d&apos;envoi réglé.
                </Notice>
              )}
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setCreated(null)} className="rounded-xl!">
                  <IconUserPlus size={16} />
                  Créer un autre compte
                </Button>
                <Button variant="secondary" onClick={() => setTab('list')} className="rounded-xl!">
                  <IconUsers size={16} />
                  Voir les comptes créés
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <SectionCard title="Identité" description="Le prénom apparaît dans l'e-mail de bienvenue.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Prénom"
                    name="firstName"
                    value={form.firstName}
                    onChange={(e) => patch({ firstName: e.target.value })}
                    error={fieldError('firstName')}
                    autoComplete="off"
                  />
                  <TextField
                    label="Nom"
                    name="lastName"
                    value={form.lastName}
                    onChange={(e) => patch({ lastName: e.target.value })}
                    error={fieldError('lastName')}
                    autoComplete="off"
                  />
                </div>
              </SectionCard>

              <SectionCard title="Coordonnées" description="L'adresse e-mail sert d'identifiant de connexion et reçoit le lien d'activation.">
                <div className="grid gap-4 sm:grid-cols-2">
                  <TextField
                    label="Adresse e-mail"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => patch({ email: e.target.value })}
                    error={fieldError('email')}
                    placeholder="prenom.nom@exemple.com"
                    autoComplete="off"
                  />
                  <TextField
                    label="Téléphone"
                    name="phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => patch({ phone: e.target.value })}
                    error={fieldError('phone')}
                    hint="Format international, avec l'indicatif du pays."
                    placeholder="+224 620 00 00 00"
                    autoComplete="off"
                  />
                </div>
                <TextField
                  label="Adresse (facultatif)"
                  name="address"
                  value={form.address}
                  onChange={(e) => patch({ address: e.target.value })}
                  placeholder="Quartier, ville"
                  maxLength={200}
                  autoComplete="off"
                />
              </SectionCard>

              <SectionCard title="Rôle" description="Les droits du compte. Le rôle SuperAdmin ne s'attribue pas depuis cette page.">
                {rolesQuery.isLoading ? (
                  <ListSkeleton count={3} heightClass="h-16" gridClass="sm:grid-cols-2" />
                ) : roles.length === 0 ? (
                  <Notice>Aucun rôle disponible. Créez d&apos;abord un rôle depuis la page « Rôles ».</Notice>
                ) : (
                  <div role="radiogroup" aria-label="Rôle" className="grid gap-2.5 sm:grid-cols-2">
                    {roles.map((role) => (
                      <RoleChoice
                        key={role.id}
                        name={role.name}
                        description={role.description}
                        selected={form.roleId === role.id}
                        onSelect={() => patch({ roleId: role.id })}
                      />
                    ))}
                  </div>
                )}
                {fieldError('roleId') ? <p className="text-xs text-danger">{fieldError('roleId')}</p> : null}
              </SectionCard>

              <SectionCard title="Pays" description="Les pays dans lesquels ce rôle s'exerce. Vous pouvez en choisir plusieurs.">
                <ToggleRow
                  checked={form.allCountries}
                  onChange={(checked) => patch({ allCountries: checked, countryIds: checked ? [] : form.countryIds })}
                  label="Tous les pays"
                  description="Le rôle s'exerce sans restriction géographique."
                />
                {form.allCountries ? null : countriesQuery.isLoading ? (
                  <ListSkeleton count={4} heightClass="h-11" gridClass="grid-cols-2 sm:grid-cols-4" />
                ) : (
                  <div className="flex flex-wrap gap-2" role="group" aria-label="Pays">
                    {countries.map((country) => {
                      const selected = form.countryIds.includes(country.id);
                      return (
                        <button
                          key={country.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleCountry(country.id)}
                          className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold shadow-sm transition ${
                            selected
                              ? 'border-primary bg-primary text-[#ffffff]'
                              : 'border-border bg-surface text-text-secondary hover:border-primary/40'
                          }`}
                        >
                          <span aria-hidden>{isoToFlagEmoji(country.isoCode)}</span>
                          {country.name}
                          {selected ? <IconCheck size={14} /> : null}
                        </button>
                      );
                    })}
                  </div>
                )}
                {fieldError('countryIds') ? <p className="text-xs text-danger">{fieldError('countryIds')}</p> : null}
              </SectionCard>

              <FormError message={serverError} />

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" loading={createMutation.isPending} className="rounded-xl! px-5!">
                  <IconUserCheck size={18} />
                  Créer le compte et envoyer l&apos;invitation
                </Button>
                <p className="text-xs text-text-muted">Aucun mot de passe n&apos;est saisi ici : la personne le choisit via le lien reçu.</p>
              </div>
            </form>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {resendNotice ? <SavedNotice>{resendNotice}</SavedNotice> : null}
          <FormError message={resendError} />
          {accountsQuery.isLoading ? (
            <ListSkeleton count={4} heightClass="h-36" />
          ) : accountsQuery.isError ? (
            <Notice tone="danger">{errorText(accountsQuery.error)}</Notice>
          ) : accounts.length === 0 ? (
            <EmptyState
              icon={<IconUsers size={26} />}
              title="Aucun compte d'équipe"
              text="Les comptes Support, Superviseur et Finance apparaîtront ici avec leur état d'activation."
              action={
                <Button onClick={() => setTab('create')} className="rounded-xl!">
                  <IconUserPlus size={16} />
                  Créer le premier compte
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {accounts.map((account) => (
                <AccountCard key={account.id} account={account} onResend={handleResend} resending={resendingId === account.id} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
