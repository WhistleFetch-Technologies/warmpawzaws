'use client';

import { ChevronDown, ChevronUp, Trash2 } from 'lucide-react';
import { Input, Label, Switch } from '@warmpawz/ui';
import type { PromoEngineBenefit, PromoRangeDraft, PromoRangeLimits } from '@/lib/promo-engine/types';
import {
  buildBenefits,
  cashbackOf,
  describeRangeBenefits,
  discountOf,
  rangeAppliesText,
  rangeBoundsLabel,
  rangeTitle,
} from '@/lib/promo-engine/ranges';
import { BenefitValueFields } from './BenefitValueFields';

function amountOrNull(raw: string): number | null {
  return raw === '' ? null : Number(raw);
}

export const RANGE_LIMIT_FIELDS: Array<{ key: keyof PromoRangeLimits; label: string; hint: string }> = [
  { key: 'budgetLimit', label: 'Budget ₹', hint: 'Discount + cashback paid in this range' },
  { key: 'dailyLimit', label: 'Daily uses', hint: 'All customers, per day' },
  { key: 'campaignLimit', label: 'Total uses', hint: 'All customers, lifetime' },
  { key: 'perUser', label: 'Per customer', hint: 'Uses per customer' },
];

export function RangeLimitInput({
  range,
  field,
  onChange,
}: {
  range: PromoRangeDraft;
  field: keyof PromoRangeLimits;
  onChange: (limits: PromoRangeLimits) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      step={field === 'budgetLimit' ? 'any' : 1}
      placeholder="No limit"
      value={range.limits[field] ?? ''}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
        onChange({ ...range.limits, [field]: amountOrNull(e.target.value) })
      }
      className="min-h-10"
    />
  );
}

export function rangeUsageText(range: PromoRangeDraft): string | null {
  if (!range.id) return null;
  const uses = range.usage?.uses ?? 0;
  const spent = range.budgetConsumed ?? 0;
  if (!uses && !spent) return 'Not used yet';
  return `${uses} use${uses === 1 ? '' : 's'} · ₹${spent.toLocaleString('en-IN')} spent`;
}

export function RangeCard({
  range,
  index,
  prev,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  range: PromoRangeDraft;
  index: number;
  prev: PromoRangeDraft | undefined;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<PromoRangeDraft>) => void;
  onRemove: () => void;
}) {
  const discount = discountOf(range.benefitJson);
  const cashback = cashbackOf(range.benefitJson);
  const usage = rangeUsageText(range);

  const setBenefits = (d: PromoEngineBenefit, c: PromoEngineBenefit | null) =>
    onChange({ benefitJson: buildBenefits(d, c) });

  return (
    <div className={`rounded-2xl border bg-white ${range.active ? 'border-slate-200' : 'border-dashed border-slate-300'}`}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={onToggle}>
          {expanded ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
          <span className="truncate font-semibold text-slate-900">{rangeTitle(range, index)}</span>
          <span className="shrink-0 rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-[#C2410C]">
            {rangeBoundsLabel(range)}
          </span>
          {!range.active ? (
            <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Off</span>
          ) : null}
        </button>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          On
          <Switch checked={range.active} onCheckedChange={(on: boolean) => onChange({ active: on })} />
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" /> Remove
        </button>
      </div>

      {expanded ? (
        <div className="space-y-4 border-t border-slate-100 p-4">
          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <p className="text-sm font-semibold text-slate-900">Order value range</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Minimum (Floor) ₹</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={range.minAmount ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({ minAmount: amountOrNull(e.target.value) })
                  }
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Maximum (Ceiling) ₹</Label>
                <Input
                  type="number"
                  min={0}
                  placeholder="No maximum"
                  value={range.maxAmount ?? ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    onChange({ maxAmount: amountOrNull(e.target.value) })
                  }
                  className="min-h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Name (optional)</Label>
                <Input
                  value={range.label}
                  maxLength={60}
                  placeholder="e.g. Small bills"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ label: e.target.value })}
                  className="min-h-11"
                />
              </div>
            </div>
            <p className="text-xs text-slate-500">{rangeAppliesText(range, prev)}</p>
          </div>

          <BenefitValueFields
            discount={discount}
            cashback={cashback}
            cashbackToggleLabel="Enable cashback for this range"
            onDiscount={(patch) => setBenefits({ ...discount, type: 'DISCOUNT', ...patch }, cashback)}
            onCashback={(patch) =>
              setBenefits(
                discount,
                patch === null
                  ? null
                  : {
                      type: 'CASHBACK',
                      mode: cashback?.mode || 'FIXED',
                      value: cashback?.value ?? 0,
                      expiryDays: cashback?.expiryDays ?? 30,
                      ...cashback,
                      ...patch,
                    },
              )
            }
          />

          <div className="space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900">Limits for this range</p>
              {usage ? <p className="text-xs text-slate-500">{usage}</p> : null}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {RANGE_LIMIT_FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <Label>{f.label}</Label>
                  <RangeLimitInput range={range} field={f.key} onChange={(limits) => onChange({ limits })} />
                  <p className="text-xs text-slate-500">{f.hint}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">
              Promotion-wide limits on the Limits step still apply on top. The same values are editable there.
            </p>
          </div>
        </div>
      ) : (
        <p className="border-t border-slate-100 px-4 py-2 text-sm text-slate-600">
          {describeRangeBenefits(range.benefitJson)}
        </p>
      )}
    </div>
  );
}
