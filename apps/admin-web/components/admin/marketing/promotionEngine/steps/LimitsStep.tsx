'use client';

import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import { STACKING_POLICIES, type PromoEngineDraft, type StackingPolicy } from '@/lib/promo-engine/types';
import {
  rangeBoundsLabel,
  rangeTitle,
  sortedRanges,
  updateRange,
  validateRangeLimits,
} from '@/lib/promo-engine/ranges';
import { RANGE_LIMIT_FIELDS, RangeLimitInput, rangeUsageText } from './RangeCard';

type LimitKey = keyof NonNullable<PromoEngineDraft['limits']>;

const COUNT_FIELDS: Array<{ key: LimitKey; label: string; help: string }> = [
  { key: 'perUser', label: 'Per user', help: 'Times one customer can get this offer.' },
  {
    key: 'perTransaction',
    label: 'Max applications per transaction',
    help: '0 disables the offer. Pay Bill applies an offer once per payment.',
  },
  { key: 'dailyLimit', label: 'Daily campaign limit', help: 'Resets at midnight IST.' },
  { key: 'campaignLimit', label: 'Campaign total uses', help: 'Across all customers.' },
];

function parseLimit(raw: string): number | null {
  if (raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function LimitsStep({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const limits = draft.limits || {};
  const ranges = draft.ranges || [];
  const sorted = sortedRanges(ranges);
  const rangeLimitErrors = sorted.flatMap((r, i) =>
    validateRangeLimits(r.limits).map((e) => `${rangeTitle(r, i)}: ${e}`)
  );

  const setLimit = (key: LimitKey, value: number | null) => {
    onChange({
      ...draft,
      limits: { ...limits, [key]: value },
    });
  };

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Usage limits</h3>
        <p className="text-xs text-slate-500">
          Leave blank for unlimited. Counts are whole numbers; refunds give the use back.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {COUNT_FIELDS.map((field) => (
            <div key={field.key}>
              <Label>{field.label}</Label>
              <Input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="Unlimited"
                value={limits[field.key] ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setLimit(field.key, parseLimit(e.target.value))
                }
              />
              <p className="mt-1 text-xs text-slate-500">{field.help}</p>
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label>Budget limit ₹</Label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={limits.budgetLimit ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLimit('budgetLimit', parseLimit(e.target.value))
              }
            />
            <p className="mt-1 text-xs text-slate-500">
              Discount + cashback given out. Cashback that would overshoot the budget is not credited.
            </p>
          </div>
        </div>
      </section>

      {sorted.length ? (
        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Limits per range</h3>
            <p className="text-xs text-slate-500">
              Same values as the Limits panel inside each range card on Benefits. Leave blank for no
              range limit; the promotion limits above still apply.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500">
                  <th className="py-2 pr-3 font-medium">Range</th>
                  {RANGE_LIMIT_FIELDS.map((f) => (
                    <th key={f.key} className="py-2 pr-3 font-medium">
                      {f.label}
                    </th>
                  ))}
                  <th className="py-2 font-medium">Used</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.key} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3">
                      <p className="font-medium text-slate-900">{rangeTitle(r, i)}</p>
                      <p className="text-xs text-slate-500">{rangeBoundsLabel(r)}</p>
                    </td>
                    {RANGE_LIMIT_FIELDS.map((f) => (
                      <td key={f.key} className="py-2 pr-3">
                        <RangeLimitInput
                          range={r}
                          field={f.key}
                          onChange={(next) =>
                            onChange({ ...draft, ranges: updateRange(ranges, r.key, { limits: next }) })
                          }
                        />
                      </td>
                    ))}
                    <td className="py-2 text-xs text-slate-500">{rangeUsageText(r) || 'New'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rangeLimitErrors.length ? (
            <ul className="space-y-1 text-xs text-red-700">
              {rangeLimitErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="text-base font-semibold text-slate-900">Stacking</h3>
        <Label>Stacking policy</Label>
        <Select
          value={draft.basics.stackingPolicy}
          onValueChange={(v: string) =>
            onChange({
              ...draft,
              basics: { ...draft.basics, stackingPolicy: v as StackingPolicy },
            })
          }
        >
          <SelectTrigger className="max-w-md bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STACKING_POLICIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-500">
          Recommended for winback: DISCOUNT_WITH_CASHBACK (one discount + cashback allowed).
        </p>
      </section>
    </div>
  );
}
