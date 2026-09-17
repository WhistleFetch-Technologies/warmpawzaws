'use client';

import { Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import { STACKING_POLICIES, type PromoEngineDraft, type StackingPolicy } from '@/lib/promo-engine/types';

export function LimitsStep({
  draft,
  onChange,
}: {
  draft: PromoEngineDraft;
  onChange: (next: PromoEngineDraft) => void;
}) {
  const limits = draft.limits || {};

  const setLimit = (key: keyof NonNullable<PromoEngineDraft['limits']>, value: number | null) => {
    onChange({
      ...draft,
      limits: { ...limits, [key]: value },
    });
  };

  return (
    <div className="space-y-4">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Usage limits</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Per user</Label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={limits.perUser ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLimit('perUser', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>
          <div>
            <Label>Per transaction</Label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={limits.perTransaction ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLimit('perTransaction', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>
          <div>
            <Label>Daily campaign limit</Label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={limits.dailyLimit ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLimit('dailyLimit', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>
          <div>
            <Label>Campaign total uses</Label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={limits.campaignLimit ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLimit('campaignLimit', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Budget limit ₹</Label>
            <Input
              type="number"
              min={0}
              placeholder="Unlimited"
              value={limits.budgetLimit ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setLimit('budgetLimit', e.target.value === '' ? null : Number(e.target.value))
              }
            />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Stacking</h3>
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
