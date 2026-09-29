'use client';

import { Input, Label } from '@warmpawz/ui';
import {
  PROMO_CUSTOMER_COPY_FIELDS,
  PROMO_CUSTOMER_COPY_MAX_LENGTH,
  PROMO_CUSTOMER_COPY_PLACEHOLDERS,
  type PromoCustomerCopyKey,
  type PromoEngineDraft,
} from '@/lib/promo-engine/types';
import { validateCustomerCopyDraft } from '@/lib/promo-engine/draft';

const SAMPLE_VARS: Record<string, string> = {
  amount: '150',
  discount: '100',
  expiryDays: '30',
  expiryDate: '29 Oct 2026',
  redeemLabel: 'anywhere on Warmpawz',
};

export function renderCopyPreview(
  template: string,
  vars: Record<string, string> = SAMPLE_VARS,
): string {
  return template
    .replace(/\{(\w+)\}/g, (whole, key: string) => vars[key] ?? whole)
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function sampleCashback(draft: PromoEngineDraft): string {
  const cb = draft.benefitJson.find((b) => b.type === 'CASHBACK' && Number(b.value) > 0);
  if (!cb) return SAMPLE_VARS.amount;
  return cb.mode === 'FIXED' ? String(cb.value) : String(cb.maxAmount ?? SAMPLE_VARS.amount);
}

export function CustomerMessageSection({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const copy = draft.customerCopy ?? {};
  const errors = validateCustomerCopyDraft(draft.customerCopy);
  const vars = { ...SAMPLE_VARS, amount: sampleCashback(draft) };

  const setField = (key: PromoCustomerCopyKey, value: string) => {
    onChange({ ...draft, customerCopy: { ...copy, [key]: value } });
  };

  const line = (key: PromoCustomerCopyKey) => {
    const field = PROMO_CUSTOMER_COPY_FIELDS.find((f) => f.key === key)!;
    return renderCopyPreview(copy[key]?.trim() || field.placeholder, vars);
  };

  return (
    <section
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
      data-testid="promo-customer-message"
    >
      <div>
        <h3 className="text-base font-semibold text-slate-900">Customer message</h3>
        <p className="mt-1 text-xs text-slate-500">
          Optional. Leave blank to use the default wording shown in grey. Amounts stay automatic — use
          placeholders:{' '}
          {PROMO_CUSTOMER_COPY_PLACEHOLDERS.map((p) => (
            <code key={p} className="mr-1 rounded bg-slate-100 px-1 py-0.5 text-[11px]">
              {`{${p}}`}
            </code>
          ))}
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="grid gap-3">
          {PROMO_CUSTOMER_COPY_FIELDS.map((field) => (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <Input
                value={copy[field.key] ?? ''}
                maxLength={PROMO_CUSTOMER_COPY_MAX_LENGTH}
                placeholder={field.placeholder}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setField(field.key, e.target.value)}
              />
            </div>
          ))}
          {errors.length ? (
            <ul className="space-y-0.5 text-xs text-red-600">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3 py-2.5 text-sm text-emerald-900">
            <p className="font-semibold text-emerald-800">{line('savingsLine')}</p>
            <p className="mt-1 flex items-center gap-1.5 font-medium">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-[11px] font-bold text-amber-900 ring-1 ring-amber-500/50">
                ₹
              </span>
              {line('earnLine')}
            </p>
            <p className="mt-1 text-xs text-emerald-800/90">{line('redeemLine')}</p>
            <p className="mt-0.5 text-[11px] text-emerald-800/80">{line('termsLine')}</p>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-100 p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-300 to-amber-500 text-lg font-bold text-amber-950 ring-2 ring-amber-200">
              ₹
            </span>
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-amber-900">{line('creditedTitle')}</p>
              <p className="text-xs text-amber-800">{line('creditedBody')}</p>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Sample values; real amounts come from each payment.</p>
        </div>
      </div>
    </section>
  );
}
