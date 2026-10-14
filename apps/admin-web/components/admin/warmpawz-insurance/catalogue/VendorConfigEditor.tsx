'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  emptyTermsDraft,
  termsDraftError,
  termsDraftToInput,
  type TermsDraft,
} from '@/components/admin/warmpawz-insurance/shared/insurance-forms';
import {
  errorMessage,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
  todayIso,
} from '@/components/admin/warmpawz-insurance/shared/insurance-ui';
import { useSaveVendorLinkConfig } from '@/hooks/warmpawz-insurance/useInsuranceAdmin';
import {
  COMMISSION_BASIS_OPTIONS,
  PAYOUT_FREQUENCY_SHORT_LABELS,
  type CommissionBasis,
  type PayoutFrequency,
  type PayoutSchedule,
  type VendorLink,
} from '@/lib/warmpawz-insurance-admin';

type FrequencyChoice = PayoutFrequency | 'default';

const FREQUENCIES = Object.keys(PAYOUT_FREQUENCY_SHORT_LABELS) as PayoutFrequency[];

function termsToDraft(link: VendorLink): TermsDraft {
  const current = link.currentTerms;
  if (!current) return emptyTermsDraft(todayIso());
  return {
    basis: current.basis,
    rate: String(current.rate),
    vendorCommissionRate: current.vendorCommissionRate == null ? '' : String(current.vendorCommissionRate),
    gstRate: String(current.gstRate),
    effectiveFrom: todayIso(),
    notes: current.notes ?? '',
  };
}

export function VendorConfigEditor({
  link,
  companyName,
  platformDefault,
  canWrite,
  onClose,
  onShowHistory,
}: {
  link: VendorLink;
  companyName: string;
  platformDefault: PayoutSchedule | undefined;
  canWrite: boolean;
  onClose: () => void;
  onShowHistory: () => void;
}) {
  const [frequency, setFrequency] = useState<FrequencyChoice>('default');
  const [terms, setTerms] = useState<TermsDraft>(() => termsToDraft(link));
  const save = useSaveVendorLinkConfig();
  const editable = canWrite && link.status !== 'ended';
  const set = <K extends keyof TermsDraft>(key: K, v: TermsDraft[K]) => setTerms((t) => ({ ...t, [key]: v }));
  const fixed = terms.basis === 'fixed_per_policy';

  useEffect(() => {
    setFrequency(link.scheduleOverride?.frequency ?? 'default');
    setTerms(termsToDraft(link));
  }, [link]);

  const submit = async () => {
    const error = termsDraftError(terms);
    if (error) return toast.error(error);
    try {
      const result = await save.mutateAsync({ id: link.id, input: { frequency, terms: termsDraftToInput(terms) } });
      if (!result.changed.terms && !result.changed.schedule) {
        toast.info('Nothing changed');
        return;
      }
      toast.success(`Saved ${link.vendorName}`);
      onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const defaultLabel = platformDefault
    ? `Platform default (${PAYOUT_FREQUENCY_SHORT_LABELS[platformDefault.frequency]})`
    : 'Platform default';

  return (
    <div className="space-y-4 rounded-lg border border-orange-100 bg-orange-50/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-gray-900">Vendor Configuration ({companyName})</h4>
        <button type="button" className="text-sm font-medium text-[#FF8C42] hover:underline" onClick={onShowHistory}>
          Link details &amp; history
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Payout Frequency">
          <select
            className={inputClass}
            value={frequency}
            disabled={!editable}
            onChange={(e) => setFrequency(e.target.value as FrequencyChoice)}
          >
            <option value="default">{defaultLabel}</option>
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {PAYOUT_FREQUENCY_SHORT_LABELS[f]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Commission Type">
          <select
            className={inputClass}
            value={terms.basis}
            disabled={!editable}
            onChange={(e) => set('basis', e.target.value as CommissionBasis)}
          >
            {COMMISSION_BASIS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={fixed ? 'Commission Amount (₹)' : 'Commission Percentage (%)'}>
          <input
            type="number"
            min={0}
            max={fixed ? undefined : 100}
            step="0.01"
            className={inputClass}
            value={terms.rate}
            disabled={!editable}
            onChange={(e) => set('rate', e.target.value)}
          />
        </Field>
        <Field label="GST on Commission (%)" hint="Required. Enter 0 if not charged">
          <input
            type="number"
            min={0}
            max={100}
            step="0.01"
            className={inputClass}
            value={terms.gstRate}
            disabled={!editable}
            onChange={(e) => set('gstRate', e.target.value)}
          />
        </Field>
        {terms.basis === 'percent_of_vendor_commission' ? (
          <Field
            label="Vendor's Expected Commission (% of premium)"
            hint="Used when the vendor hasn't recorded their actual commission"
          >
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              className={inputClass}
              value={terms.vendorCommissionRate}
              disabled={!editable}
              onChange={(e) => set('vendorCommissionRate', e.target.value)}
            />
          </Field>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-gray-500">
          Commission changes apply to policies issued from today; earlier policies keep their terms. Changing the
          frequency starts a fresh payout cycle.
        </p>
        <div className="flex gap-2">
          <button type="button" className={secondaryButtonClass} onClick={onClose}>
            {editable ? 'Cancel' : 'Close'}
          </button>
          {editable ? (
            <button type="button" className={primaryButtonClass} disabled={save.isPending} onClick={submit}>
              {save.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
