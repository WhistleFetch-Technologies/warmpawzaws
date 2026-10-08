'use client';

import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@warmpawz/ui';
import type { PromoEngineBenefit } from '@/lib/promo-engine/types';

type ValueMode = 'PERCENT' | 'FIXED';

const DEFAULT_CASHBACK: PromoEngineBenefit = { type: 'CASHBACK', mode: 'FIXED', value: 50, expiryDays: 30 };

function numberOrUndefined(raw: string): number | undefined {
  return raw === '' ? undefined : Number(raw);
}

function ModeSelect({ value, onChange }: { value: ValueMode; onChange: (v: ValueMode) => void }) {
  return (
    <Select value={value} onValueChange={(v: string) => onChange(v as ValueMode)}>
      <SelectTrigger className="min-h-11 bg-white">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="FIXED">Fixed ₹</SelectItem>
        <SelectItem value="PERCENT">Percentage</SelectItem>
      </SelectContent>
    </Select>
  );
}

/**
 * Discount + cashback inputs for one offer (the whole promotion, or one bill range).
 * `cashback === null` means cashback is off.
 */
export function BenefitValueFields({
  discount,
  cashback,
  onDiscount,
  onCashback,
  maxDiscountFallback,
  cashbackToggleLabel = 'Enable cashback',
}: {
  discount: PromoEngineBenefit;
  cashback: PromoEngineBenefit | null;
  onDiscount: (patch: Partial<PromoEngineBenefit>) => void;
  onCashback: (patch: Partial<PromoEngineBenefit> | null) => void;
  maxDiscountFallback?: number;
  cashbackToggleLabel?: string;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <p className="text-sm font-semibold text-slate-900">Discount</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Value type</Label>
            <ModeSelect
              value={(discount.mode as ValueMode) || 'PERCENT'}
              onChange={(mode) => onDiscount({ mode })}
            />
          </div>
          <div className="space-y-2">
            <Label>Value</Label>
            <Input
              type="number"
              min={0}
              value={discount.value ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onDiscount({ value: e.target.value === '' ? 0 : Number(e.target.value) })
              }
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label>Max discount ₹</Label>
            <Input
              type="number"
              min={0}
              value={discount.maxAmount ?? maxDiscountFallback ?? ''}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                onDiscount({ maxAmount: numberOrUndefined(e.target.value) })
              }
              className="min-h-11"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">Max discount caps the instant discount only.</p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-900">Cashback</p>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            {cashbackToggleLabel}
            <Switch
              checked={cashback !== null}
              onCheckedChange={(on: boolean) => onCashback(on ? { ...DEFAULT_CASHBACK } : null)}
            />
          </label>
        </div>
        {cashback ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label>Value type</Label>
              <ModeSelect
                value={(cashback.mode as ValueMode) || 'FIXED'}
                onChange={(mode) => onCashback({ mode })}
              />
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input
                type="number"
                min={0}
                value={cashback.value ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onCashback({ value: e.target.value === '' ? 0 : Number(e.target.value) })
                }
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Max cashback ₹</Label>
              <Input
                type="number"
                min={0}
                value={cashback.maxAmount ?? ''}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onCashback({ maxAmount: numberOrUndefined(e.target.value) })
                }
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label>Expires (days)</Label>
              <Input
                type="number"
                min={1}
                value={cashback.expiryDays ?? 30}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  onCashback({ expiryDays: Number(e.target.value) || 30 })
                }
                className="min-h-11"
              />
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Optional. Combine discount + cashback in one offer.</p>
        )}
      </div>
    </div>
  );
}
