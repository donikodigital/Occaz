// web-admin/src/components/accounting/StaffPayModal.tsx
// [25/10/2026] v1 — Fiche de paie d'un membre du personnel (SuperAdmin, Support, Superviseur…) : de quoi produire son bulletin de salaire.
// L'identité (nom, adresse) vient de son compte ; ici : matricule, emploi, embauche, n° de sécurité sociale, salaire de base, primes fixes et
// retenues. Les taux de retenue sont à fixer avec le comptable : l'application n'en impose aucun. Le net est estimé pendant la saisie ; le
// serveur le recalcule toujours.
'use client';

import React, { useMemo, useState } from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Button, Modal, Select, TextField } from '@/components/ui';
import { FormError, Notice } from '@/components/admin/AdminUi';
import { useSavePayProfile } from '@/hooks/useAccounting';
import { ApiError } from '@/services/api/ApiError';
import type { PayAllowance, PayDeduction, StaffPaySummary } from '@/types/accounting.types';
import { formatMoney } from '@/utils/money';
import { basisPointsToPercent, estimatePayslip, percentToBasisPoints } from '@/utils/payslip';

interface AllowanceDraft {
  id: string;
  label: string;
  amount: string;
}

interface DeductionDraft {
  id: string;
  label: string;
  kind: 'PERCENT' | 'FIXED';
  /** PERCENT : saisi en pour cent (« 5 », « 5,5 ») ; FIXED : montant. */
  value: string;
}

let counter = 0;
const nextId = () => `row-${Date.now()}-${(counter += 1)}`;
const digitsOnly = (value: string) => value.replace(/\D/g, '');
const groupDigits = (value: string) => (value ? new Intl.NumberFormat('fr-FR').format(Number(value)) : '');

function toAllowances(rows: AllowanceDraft[]): { items: PayAllowance[]; invalid: boolean } {
  const items: PayAllowance[] = [];
  let invalid = false;
  for (const row of rows) {
    if (!row.label.trim() && !row.amount) continue;
    if (row.label.trim().length < 1 || !/^[1-9]\d{0,14}$/.test(row.amount)) invalid = true;
    else items.push({ label: row.label.trim(), amount: row.amount });
  }
  return { items, invalid };
}

function toDeductions(rows: DeductionDraft[]): { items: PayDeduction[]; invalid: boolean } {
  const items: PayDeduction[] = [];
  let invalid = false;
  for (const row of rows) {
    if (!row.label.trim() && !row.value) continue;
    const value = row.kind === 'PERCENT' ? percentToBasisPoints(row.value) : /^[1-9]\d{0,14}$/.test(row.value) ? row.value : '';
    if (!row.label.trim() || !value) invalid = true;
    else items.push({ label: row.label.trim(), kind: row.kind, value });
  }
  return { items, invalid };
}

export function StaffPayModal({
  staff,
  currencies,
  onClose,
  onSaved,
}: {
  staff: StaffPaySummary;
  currencies: Array<{ currencyId: string; isoCode: string }>;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const save = useSavePayProfile();
  const pay = staff.pay;
  const [fullName, setFullName] = useState(pay?.fullName ?? '');
  const [employeeNumber, setEmployeeNumber] = useState(pay?.employeeNumber ?? '');
  const [jobTitle, setJobTitle] = useState(pay?.jobTitle ?? '');
  const [hireDate, setHireDate] = useState(pay?.hireDate ?? '');
  const [socialSecurityNumber, setSocialSecurityNumber] = useState(pay?.socialSecurityNumber ?? '');
  const [currencyId, setCurrencyId] = useState(pay?.currencyId ?? currencies[0]?.currencyId ?? '');
  const [baseSalary, setBaseSalary] = useState(pay?.baseSalary && pay.baseSalary !== '0' ? pay.baseSalary : '');
  const [allowances, setAllowances] = useState<AllowanceDraft[]>(() => (pay?.allowances ?? []).map((item) => ({ id: nextId(), label: item.label, amount: item.amount })));
  const [deductions, setDeductions] = useState<DeductionDraft[]>(() =>
    (pay?.deductions ?? []).map((item) => ({ id: nextId(), label: item.label, kind: item.kind, value: item.kind === 'PERCENT' ? basisPointsToPercent(item.value) : item.value })),
  );

  const isoCode = currencies.find((item) => item.currencyId === currencyId)?.isoCode ?? '';
  const parsedAllowances = useMemo(() => toAllowances(allowances), [allowances]);
  const parsedDeductions = useMemo(() => toDeductions(deductions), [deductions]);
  const estimate = useMemo(() => estimatePayslip(baseSalary, parsedAllowances.items, parsedDeductions.items), [baseSalary, parsedAllowances, parsedDeductions]);

  const nameMissing = !staff.hasIdentity && fullName.trim().length < 2;
  const valid = /^[1-9]\d{0,14}$/.test(baseSalary) && !!currencyId && !parsedAllowances.invalid && !parsedDeductions.invalid && estimate.net > 0n && !nameMissing;
  const error = save.error ? (save.error instanceof ApiError ? save.error.message : 'Enregistrement impossible.') : undefined;

  function submit() {
    save.mutate(
      {
        userId: staff.userId,
        fullName: staff.hasIdentity ? undefined : fullName.trim(),
        employeeNumber: employeeNumber.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        hireDate: hireDate || undefined,
        socialSecurityNumber: socialSecurityNumber.trim() || undefined,
        baseSalary,
        currencyId,
        allowances: parsedAllowances.items,
        deductions: parsedDeductions.items,
      },
      {
        onSuccess: () => {
          onSaved(`Fiche de paie de ${staff.fullName} enregistrée.`);
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={`Fiche de paie · ${staff.fullName}`}
      description={staff.roles.join(', ') || 'Administration'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button loading={save.isPending} disabled={!valid} onClick={submit}>
            Enregistrer
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Notice>
          Les retenues (cotisations, impôt…) et leurs taux sont à fixer avec ton comptable : Occa’Z n’en impose aucun. Chaque bulletin émis garde une
          copie figée de cette fiche : la modifier ne change jamais un bulletin déjà établi.
        </Notice>

        <div className="rounded-xl bg-surface-muted/70 px-3.5 py-2.5 text-xs leading-relaxed text-text-secondary">
          <p>
            <span className="font-semibold text-text-primary">Repris du compte :</span> {staff.fullName}
            {staff.address ? ` · ${staff.address}` : ''} · {staff.phone}
            {staff.email ? ` · ${staff.email}` : ''}
          </p>
        </div>

        {!staff.hasIdentity ? (
          <TextField label="Nom à afficher sur le bulletin" placeholder="Nom et prénom" value={fullName} onChange={(event) => setFullName(event.target.value)} hint="Ce compte n’a pas d’identité enregistrée." />
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Matricule" placeholder="EMP-014" value={employeeNumber} onChange={(event) => setEmployeeNumber(event.target.value)} />
          <TextField label="Emploi" placeholder="Agent support" value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} />
          <TextField label="Date d’embauche" type="date" value={hireDate} onChange={(event) => setHireDate(event.target.value)} />
          <TextField label="N° de sécurité sociale" value={socialSecurityNumber} onChange={(event) => setSocialSecurityNumber(event.target.value)} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <Select label="Devise" value={currencyId} onChange={(event) => setCurrencyId(event.target.value)}>
              {currencies.map((item) => (
                <option key={item.currencyId} value={item.currencyId}>
                  {item.isoCode}
                </option>
              ))}
            </Select>
          </div>
          <div className="col-span-2">
            <TextField
              label="Salaire de base mensuel"
              inputMode="numeric"
              placeholder="0"
              value={groupDigits(baseSalary)}
              onChange={(event) => setBaseSalary(digitsOnly(event.target.value).replace(/^0+/, ''))}
            />
          </div>
        </div>

        {/* Primes et indemnités fixes */}
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-semibold text-text-primary">Primes et indemnités fixes</p>
            <p className="text-xs text-text-secondary">Ajoutées au salaire de base chaque mois (transport, logement…).</p>
          </div>
          {allowances.map((row) => (
            <div key={row.id} className="flex items-start gap-2 rounded-xl bg-surface-muted/70 p-2.5 shadow-sm">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-5">
                <div className="sm:col-span-3">
                  <TextField aria-label="Libellé de la prime" placeholder="Prime de transport" value={row.label} onChange={(event) => setAllowances((rows) => rows.map((item) => (item.id === row.id ? { ...item, label: event.target.value } : item)))} />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    aria-label="Montant de la prime"
                    inputMode="numeric"
                    placeholder={`Montant (${isoCode})`}
                    value={groupDigits(row.amount)}
                    onChange={(event) => setAllowances((rows) => rows.map((item) => (item.id === row.id ? { ...item, amount: digitsOnly(event.target.value).replace(/^0+/, '') } : item)))}
                  />
                </div>
              </div>
              <button type="button" aria-label="Supprimer cette prime" onClick={() => setAllowances((rows) => rows.filter((item) => item.id !== row.id))} className="mt-1.5 rounded-lg p-1.5 text-text-muted transition hover:bg-danger-light hover:text-danger-dark">
                <IconTrash size={16} />
              </button>
            </div>
          ))}
          <Button variant="outline" className="!px-3 !py-1.5 !text-xs" disabled={allowances.length >= 20} onClick={() => setAllowances((rows) => [...rows, { id: nextId(), label: '', amount: '' }])}>
            <IconPlus size={14} />
            Ajouter une prime
          </Button>
        </div>

        {/* Retenues */}
        <div className="space-y-2.5">
          <div>
            <p className="text-sm font-semibold text-text-primary">Retenues</p>
            <p className="text-xs text-text-secondary">Cotisations sociales, impôt, avances… En pourcentage du salaire brut, ou en montant fixe.</p>
          </div>
          {deductions.map((row) => (
            <div key={row.id} className="flex items-start gap-2 rounded-xl bg-surface-muted/70 p-2.5 shadow-sm">
              <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-6">
                <div className="sm:col-span-3">
                  <TextField aria-label="Libellé de la retenue" placeholder="Cotisation sociale" value={row.label} onChange={(event) => setDeductions((rows) => rows.map((item) => (item.id === row.id ? { ...item, label: event.target.value } : item)))} />
                </div>
                <div className="sm:col-span-1">
                  <Select aria-label="Type de retenue" value={row.kind} onChange={(event) => setDeductions((rows) => rows.map((item) => (item.id === row.id ? { ...item, kind: event.target.value as 'PERCENT' | 'FIXED', value: '' } : item)))}>
                    <option value="PERCENT">%</option>
                    <option value="FIXED">{isoCode || 'Montant'}</option>
                  </Select>
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    aria-label="Valeur de la retenue"
                    inputMode={row.kind === 'PERCENT' ? 'decimal' : 'numeric'}
                    placeholder={row.kind === 'PERCENT' ? 'Ex. 5 ou 5,5' : 'Montant'}
                    value={row.kind === 'PERCENT' ? row.value : groupDigits(row.value)}
                    onChange={(event) =>
                      setDeductions((rows) =>
                        rows.map((item) =>
                          item.id === row.id
                            ? { ...item, value: row.kind === 'PERCENT' ? event.target.value.replace(/[^\d,.]/g, '').slice(0, 6) : digitsOnly(event.target.value).replace(/^0+/, '') }
                            : item,
                        ),
                      )
                    }
                  />
                </div>
              </div>
              <button type="button" aria-label="Supprimer cette retenue" onClick={() => setDeductions((rows) => rows.filter((item) => item.id !== row.id))} className="mt-1.5 rounded-lg p-1.5 text-text-muted transition hover:bg-danger-light hover:text-danger-dark">
                <IconTrash size={16} />
              </button>
            </div>
          ))}
          <Button variant="outline" className="!px-3 !py-1.5 !text-xs" disabled={deductions.length >= 20} onClick={() => setDeductions((rows) => [...rows, { id: nextId(), label: '', kind: 'PERCENT', value: '' }])}>
            <IconPlus size={14} />
            Ajouter une retenue
          </Button>
        </div>

        {/* Estimation */}
        <div className="space-y-1.5 rounded-2xl bg-primary-light/50 p-3.5 shadow-sm">
          <p className="text-xs font-semibold text-text-secondary">Estimation du bulletin mensuel</p>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-text-secondary">Salaire brut</span>
            <span className="font-medium tabular-nums">{formatMoney(estimate.gross.toString(), isoCode)}</span>
          </div>
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-text-secondary">Retenues</span>
            <span className="font-medium tabular-nums text-danger-dark">− {formatMoney(estimate.totalDeductions.toString(), isoCode)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-2">
            <span className="text-sm font-semibold text-text-primary">Net à payer</span>
            <span className={`text-xl font-bold tabular-nums ${estimate.net > 0n ? 'text-primary' : 'text-danger'}`}>{formatMoney(estimate.net.toString(), isoCode)}</span>
          </div>
          {estimate.net <= 0n && baseSalary ? <p className="text-xs text-danger">Les retenues dépassent le salaire brut.</p> : null}
          {parsedAllowances.invalid || parsedDeductions.invalid ? <p className="text-xs text-danger">Une ligne est incomplète : renseigne le libellé et la valeur, ou supprime-la.</p> : null}
        </div>

        <FormError message={error} />
      </div>
    </Modal>
  );
}
