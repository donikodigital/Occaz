// web-admin/src/components/platformWallet/ExpenseMotifForm.tsx
// [25/10/2026] v1 — « Pourquoi ce retrait ? » : choix du motif (7 tuiles) puis les champs que CE motif exige. Chaque motif produit une pièce PDF :
// salaire → bulletin de paie (net calculé depuis la fiche de la personne), prime → reçu, fournitures / équipements → facture d'achat (montant =
// total des lignes), voyage → note de frais, fonctionnement / autres → justificatif. Composant d'affichage : l'état vit dans la fenêtre de retrait.
'use client';

import React from 'react';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { Button, Select, TextArea, TextField } from '@/components/ui';
import { FormError, Notice } from '@/components/admin/AdminUi';
import { EXPENSE_ICONS } from '@/components/platformWallet/ExpenseParts';
import { ApiError } from '@/services/api/ApiError';
import type { StaffPaySummary } from '@/types/accounting.types';
import type { ExpenseCategory, PayslipPreview } from '@/types/platform-wallet.types';
import { EXPENSE_CATEGORY_INFO, EXPENSE_CATEGORY_ORDER, periodLabel, recentPeriods } from '@/utils/expenseCategories';
import { filledLines, lineIsValid, lineTotal, newLine, type LineDraft, type MotifDraft } from '@/utils/motifDraft';
import { formatMoney } from '@/utils/money';

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const groupDigits = (value: string) => (value ? new Intl.NumberFormat('fr-FR').format(Number(value)) : '');

interface Props {
  draft: MotifDraft;
  onChange: (draft: MotifDraft) => void;
  currencyId: string;
  isoCode: string;
  /** Personnel de l'administration (réservé à ceux qui gèrent le portefeuille). */
  staff: StaffPaySummary[] | undefined;
  staffLoading: boolean;
  preview: { data: PayslipPreview | undefined; isLoading: boolean; error: unknown };
}

function LineEditor({ line, index, iso, canRemove, onChange, onRemove }: { line: LineDraft; index: number; iso: string; canRemove: boolean; onChange: (line: LineDraft) => void; onRemove: () => void }) {
  const touched = !!(line.description || line.unitPrice);
  const valid = lineIsValid(line);
  return (
    <div className="space-y-2 rounded-xl bg-surface-muted/70 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-text-secondary">Ligne {index + 1}</p>
        {canRemove ? (
          <button type="button" onClick={onRemove} aria-label={`Supprimer la ligne ${index + 1}`} className="rounded-lg p-1.5 text-text-muted transition hover:bg-danger-light hover:text-danger-dark">
            <IconTrash size={16} />
          </button>
        ) : null}
      </div>
      <TextField
        aria-label={`Désignation de la ligne ${index + 1}`}
        placeholder="Désignation (ex. Ramettes de papier A4)"
        value={line.description}
        onChange={(event) => onChange({ ...line, description: event.target.value })}
      />
      <div className="grid grid-cols-5 gap-2">
        <div className="col-span-2">
          <TextField
            aria-label={`Quantité de la ligne ${index + 1}`}
            inputMode="numeric"
            placeholder="Qté"
            value={line.quantity}
            onChange={(event) => onChange({ ...line, quantity: digitsOnly(event.target.value).replace(/^0+/, '') })}
          />
        </div>
        <div className="col-span-3">
          <TextField
            aria-label={`Prix unitaire de la ligne ${index + 1}`}
            inputMode="numeric"
            placeholder={`Prix unitaire (${iso})`}
            value={groupDigits(line.unitPrice)}
            onChange={(event) => onChange({ ...line, unitPrice: digitsOnly(event.target.value).replace(/^0+/, '') })}
          />
        </div>
      </div>
      <p className={`text-right text-xs tabular-nums ${touched && !valid ? 'text-danger' : 'text-text-secondary'}`}>
        {valid ? `Total de la ligne : ${formatMoney(lineTotal(line).toString(), iso)}` : touched ? 'Ligne incomplète' : ' '}
      </p>
    </div>
  );
}

function LinesEditor({ draft, iso, onChange, title, optionalText }: { draft: MotifDraft; iso: string; onChange: (draft: MotifDraft) => void; title: string; optionalText?: string }) {
  const total = filledLines(draft).reduce((sum, line) => sum + lineTotal(line), 0n);
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-semibold text-text-primary">{title}</p>
        {optionalText ? <p className="text-xs text-text-secondary">{optionalText}</p> : null}
      </div>
      {draft.lines.map((line, index) => (
        <LineEditor
          key={line.id}
          line={line}
          index={index}
          iso={iso}
          canRemove={draft.lines.length > 1}
          onChange={(next) => onChange({ ...draft, lines: draft.lines.map((item) => (item.id === line.id ? next : item)) })}
          onRemove={() => onChange({ ...draft, lines: draft.lines.filter((item) => item.id !== line.id) })}
        />
      ))}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" className="!px-3 !py-1.5 !text-xs" disabled={draft.lines.length >= 50} onClick={() => onChange({ ...draft, lines: [...draft.lines, newLine()] })}>
          <IconPlus size={14} />
          Ajouter une ligne
        </Button>
        {total > 0n ? <p className="text-sm font-bold tabular-nums text-text-primary">Total : {formatMoney(total.toString(), iso)}</p> : null}
      </div>
    </div>
  );
}

/** Résumé du bulletin calculé : brut, retenues, net à payer. */
function PayslipCard({ preview, iso }: { preview: PayslipPreview; iso: string }) {
  const { payslip } = preview;
  return (
    <div className="space-y-2 rounded-2xl bg-primary-light/50 p-3.5 shadow-sm">
      <p className="text-xs font-semibold text-text-secondary">
        Bulletin de {preview.staff.fullName} · {preview.periodLabel}
      </p>
      <div className="space-y-1 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-text-secondary">Salaire de base</span>
          <span className="font-medium tabular-nums">{formatMoney(payslip.baseSalary, iso)}</span>
        </div>
        {payslip.allowances.map((line) => (
          <div key={line.label} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-text-secondary">{line.label}</span>
            <span className="font-medium tabular-nums">+ {formatMoney(line.amount, iso)}</span>
          </div>
        ))}
        <div className="flex justify-between gap-3 border-t border-border/70 pt-1">
          <span className="font-semibold">Brut</span>
          <span className="font-semibold tabular-nums">{formatMoney(payslip.gross, iso)}</span>
        </div>
        {payslip.deductions.map((line) => (
          <div key={line.label} className="flex justify-between gap-3">
            <span className="min-w-0 truncate text-text-secondary">{line.label}</span>
            <span className="font-medium tabular-nums text-danger-dark">− {formatMoney(line.amount, iso)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-baseline justify-between gap-3 border-t border-border/70 pt-2">
        <span className="text-sm font-semibold text-text-primary">Net à payer</span>
        <span className="text-xl font-bold tabular-nums text-primary">{formatMoney(payslip.net, iso)}</span>
      </div>
    </div>
  );
}

export function ExpenseMotifForm({ draft, onChange, currencyId, isoCode, staff, staffLoading, preview }: Props) {
  const info = EXPENSE_CATEGORY_INFO[draft.category];
  const set = (patch: Partial<MotifDraft>) => onChange({ ...draft, ...patch });
  const periods = recentPeriods();

  const people = (staff ?? []).filter((person) => person.isActive || person.userId === draft.staffUserId);
  // Un salaire se verse dans la devise de la fiche : les autres personnes ne sont pas proposables ici.
  const salaryProblem = (person: StaffPaySummary): string | null => {
    if (draft.category !== 'SALARY') return null;
    if (!person.payReady) return 'fiche de paie à compléter';
    if (person.pay && person.pay.currencyId !== currencyId) return `salaire en ${person.pay.isoCode}`;
    return null;
  };
  const previewError = preview.error ? (preview.error instanceof ApiError ? preview.error.message : 'Impossible de calculer le bulletin.') : undefined;

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1.5 text-sm font-medium text-text-secondary">Pourquoi ce retrait ?</p>
        <div role="radiogroup" aria-label="Motif du retrait" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {EXPENSE_CATEGORY_ORDER.map((category: ExpenseCategory) => {
            const active = category === draft.category;
            return (
              <button
                key={category}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ category })}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition ${
                  active ? 'border-primary bg-primary-light text-primary ring-1 ring-primary/30' : 'border-border bg-surface text-text-secondary hover:border-primary/40'
                }`}
              >
                <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{EXPENSE_ICONS[category]}</span>
                <span className="min-w-0 leading-tight">{EXPENSE_CATEGORY_INFO[category].label}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 rounded-xl bg-surface-muted/70 px-3 py-2 text-xs leading-relaxed text-text-secondary">
          <span className="font-semibold text-text-primary">Pièce générée : {info.document}.</span> {info.hint}
        </p>
      </div>

      {info.needsStaff ? (
        <div className="space-y-3">
          <Select label="Personne" value={draft.staffUserId} onChange={(event) => set({ staffUserId: event.target.value })}>
            <option value="">{staffLoading ? 'Chargement…' : 'Choisir dans le personnel de l’administration'}</option>
            {people.map((person) => {
              const problem = salaryProblem(person);
              return (
                <option key={person.userId} value={person.userId} disabled={!!problem}>
                  {person.fullName} · {person.roles.join(', ') || 'Administration'}
                  {problem ? ` (${problem})` : ''}
                </option>
              );
            })}
          </Select>
          {!staffLoading && (staff ?? []).length === 0 ? <Notice>Aucun membre du personnel trouvé. Les comptes d’équipe se créent dans « Création comptes ».</Notice> : null}
          {draft.category === 'SALARY' ? (
            <>
              <Select label="Mois du salaire" value={draft.periodMonth} onChange={(event) => set({ periodMonth: event.target.value })}>
                {periods.map((period) => (
                  <option key={period.value} value={period.value}>
                    {period.label}
                  </option>
                ))}
              </Select>
              {draft.staffUserId ? (
                preview.isLoading ? (
                  <div className="h-28 animate-pulse rounded-2xl bg-surface-muted" />
                ) : preview.data ? (
                  <>
                    <PayslipCard preview={preview.data} iso={isoCode} />
                    {preview.data.alreadyPaid ? (
                      <Notice tone="danger">
                        Le salaire de {periodLabel(preview.data.payslip.period)} a déjà été versé (pièce {preview.data.alreadyPaid}).
                      </Notice>
                    ) : null}
                  </>
                ) : (
                  <FormError message={previewError} />
                )
              ) : null}
            </>
          ) : null}
        </div>
      ) : null}

      {draft.category === 'OTHER' ? (
        <TextField
          label="Motif"
          placeholder="Ex. Frais de réception, assurance, formation…"
          maxLength={60}
          value={draft.categoryLabel}
          onChange={(event) => set({ categoryLabel: event.target.value })}
        />
      ) : null}

      {draft.category === 'TRAVEL' ? (
        <div className="space-y-3">
          <TextField label="Voyageur" placeholder="Nom et prénom" value={draft.traveler} onChange={(event) => set({ traveler: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Départ" placeholder="Conakry" value={draft.from} onChange={(event) => set({ from: event.target.value })} />
            <TextField label="Destination" placeholder="Labé" value={draft.to} onChange={(event) => set({ to: event.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Date d’aller" type="date" value={draft.departureDate} onChange={(event) => set({ departureDate: event.target.value })} />
            <TextField label="Date de retour" type="date" value={draft.returnDate} onChange={(event) => set({ returnDate: event.target.value })} />
          </div>
        </div>
      ) : null}

      {info.needsSupplier ? (
        <div className="space-y-3">
          <TextField label="Fournisseur" placeholder="Nom du magasin ou de l’entreprise" value={draft.supplierName} onChange={(event) => set({ supplierName: event.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <TextField label="Téléphone (facultatif)" inputMode="tel" value={draft.supplierPhone} onChange={(event) => set({ supplierPhone: event.target.value })} />
            <TextField label="N° de sa facture (facultatif)" value={draft.supplierRef} onChange={(event) => set({ supplierRef: event.target.value })} />
          </div>
          <TextField label="Adresse (facultatif)" value={draft.supplierAddress} onChange={(event) => set({ supplierAddress: event.target.value })} />
        </div>
      ) : null}

      {info.needsLines ? <LinesEditor draft={draft} iso={isoCode} onChange={onChange} title="Ce qui a été acheté" /> : null}
      {draft.category === 'TRAVEL' ? (
        <LinesEditor draft={draft} iso={isoCode} onChange={onChange} title="Détail des frais (facultatif)" optionalText="Si tu détailles, le montant du retrait est le total des lignes. Sinon, saisis le montant plus bas." />
      ) : null}

      {draft.category === 'BONUS' || draft.category === 'OPERATING' || draft.category === 'OTHER' || draft.category === 'TRAVEL' || info.needsSupplier ? (
        <TextArea
          label={
            draft.category === 'BONUS'
              ? 'Raison de la prime'
              : draft.category === 'TRAVEL'
                ? 'But du voyage'
                : info.needsSupplier
                  ? 'Observations (facultatif)'
                  : 'Objet de la dépense'
          }
          rows={2}
          maxLength={300}
          placeholder={
            draft.category === 'BONUS'
              ? 'Objectifs du trimestre atteints…'
              : draft.category === 'TRAVEL'
                ? 'Visite des conducteurs de Labé…'
                : info.needsSupplier
                  ? 'Réapprovisionnement annuel…'
                  : 'Facture d’électricité d’octobre…'
          }
          value={draft.reason}
          onChange={(event) => set({ reason: event.target.value })}
        />
      ) : null}
    </div>
  );
}
