'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';
import { DomainScopeSelector } from '../shared/DomainScopeSelector';
import { CAP_OVERFLOW_OPTIONS } from '@/lib/discount-policy/option-registry';
import type { CapOverflowStrategy, DiscountPolicyBundle, PolicyScope } from '@/lib/discount-policy/types';

function getLimits(draft: DiscountPolicyBundle, scope: PolicyScope) {
  if (scope === 'global') return draft.limits.global;
  return { ...draft.limits.global, ...draft.limits.domains?.[scope] };
}

export function LimitsConfigSection({
  draft,
  onChange,
}: {
  draft: DiscountPolicyBundle;
  onChange: (bundle: DiscountPolicyBundle) => void;
}) {
  const [scope, setScope] = useState<PolicyScope>('global');
  const limits = getLimits(draft, scope);

  const patchLimit = (key: keyof typeof limits, value: number | CapOverflowStrategy) => {
    const next = structuredClone(draft);
    if (scope === 'global') {
      (next.limits.global as Record<string, unknown>)[key] = value;
    } else {
      next.limits.domains = next.limits.domains ?? {};
      next.limits.domains[scope] = { ...next.limits.domains[scope], [key]: value };
    }
    onChange(next);
  };

  const numericFields: { key: keyof typeof limits; label: string; max?: number }[] = [
    { key: 'maxAutoPromotions', label: 'Max auto promotions' },
    { key: 'maxVendorPromotions', label: 'Max vendor promotions' },
    { key: 'maxPlatformPromotions', label: 'Max platform promotions' },
    { key: 'maxCoupons', label: 'Max coupons' },
    { key: 'maxTotalDiscounts', label: 'Max total discounts' },
    { key: 'maxTotalDiscountPercent', label: 'Max discount %', max: 100 },
    { key: 'minPayableAmount', label: 'Min payable amount (₹)' },
  ];

  return (
    <div className="space-y-6">
      <DomainScopeSelector scope={scope} onScopeChange={setScope} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Discount limits</CardTitle>
            <CardDescription>
              Caps on promotions and coupons per booking — enforced by the Limit Engine at runtime.
            </CardDescription>
          </div>
          <PolicyHelpButton docKey="discount-limits-policy" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {numericFields.map(({ key, label, max }) => (
              <div key={String(key)} className="space-y-2">
                <Label htmlFor={`limit-${String(key)}`}>{label}</Label>
                <Input
                  id={`limit-${String(key)}`}
                  type="number"
                  min={0}
                  max={max}
                  value={limits[key] as number}
                  onChange={(e) => patchLimit(key, Number(e.target.value))}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2 sm:max-w-md">
            <Label htmlFor="cap-overflow">Cap overflow strategy</Label>
            <Select
              value={limits.capOverflowStrategy}
              onValueChange={(v) => patchLimit('capOverflowStrategy', v as CapOverflowStrategy)}
            >
              <SelectTrigger id="cap-overflow" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CAP_OVERFLOW_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            Per-customer, per-vendor, and per-campaign limit scopes will bind to LimitConfiguration.campaigns
            when the policy API exposes those scopes.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
