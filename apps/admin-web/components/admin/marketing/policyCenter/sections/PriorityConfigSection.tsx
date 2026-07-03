'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Input,
  Badge,
} from '@warmpawz/ui';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';
import { DomainScopeSelector } from '../shared/DomainScopeSelector';
import {
  PRIORITY_STRATEGY_OPTIONS,
  TIE_BREAKER_OPTIONS,
} from '@/lib/discount-policy/option-registry';
import type { DiscountPolicyBundle, PolicyScope, PriorityStrategyKey } from '@/lib/discount-policy/types';

export function PriorityConfigSection({
  draft,
  onChange,
}: {
  draft: DiscountPolicyBundle;
  onChange: (bundle: DiscountPolicyBundle) => void;
}) {
  const [scope, setScope] = useState<PolicyScope>('global');

  const strategy =
    scope === 'global'
      ? draft.priority.global.strategy
      : draft.priority.domains?.[scope]?.strategy ?? draft.priority.global.strategy;

  const autoMax =
    scope === 'global'
      ? draft.priority.global.phases.AUTO_PROMOTIONS?.maxSelected ?? 2
      : draft.priority.domains?.[scope]?.phases?.AUTO_PROMOTIONS?.maxSelected ??
        draft.priority.global.phases.AUTO_PROMOTIONS?.maxSelected ??
        2;

  const couponMax =
    scope === 'global'
      ? draft.priority.global.phases.COUPONS?.maxSelected ?? 1
      : draft.priority.domains?.[scope]?.phases?.COUPONS?.maxSelected ??
        draft.priority.global.phases.COUPONS?.maxSelected ??
        1;

  const strategyMeta = PRIORITY_STRATEGY_OPTIONS.find((o) => o.value === strategy);

  const setStrategy = (value: PriorityStrategyKey) => {
    const next = structuredClone(draft);
    if (scope === 'global') {
      next.priority.global.strategy = value;
    } else {
      next.priority.domains = next.priority.domains ?? {};
      next.priority.domains[scope] = {
        ...next.priority.domains[scope],
        strategy: value,
      };
    }
    onChange(next);
  };

  const setPhaseMax = (phase: 'AUTO_PROMOTIONS' | 'COUPONS', max: number) => {
    const next = structuredClone(draft);
    if (scope === 'global') {
      next.priority.global.phases = {
        ...next.priority.global.phases,
        [phase]: { maxSelected: max },
      };
    } else {
      next.priority.domains = next.priority.domains ?? {};
      const domain = next.priority.domains[scope] ?? {};
      domain.phases = { ...domain.phases, [phase]: { maxSelected: max } };
      next.priority.domains[scope] = domain;
    }
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <DomainScopeSelector scope={scope} onScopeChange={setScope} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Priority strategy</CardTitle>
            <CardDescription>
              Controls how eligible promotions and coupons are ranked before stacking.
            </CardDescription>
          </div>
          <PolicyHelpButton docKey="discount-priority-policy" />
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="priority-strategy">Strategy</Label>
            <Select value={strategy} onValueChange={(v) => setStrategy(v as PriorityStrategyKey)}>
              <SelectTrigger id="priority-strategy" className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_STRATEGY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {strategyMeta ? (
              <p className="text-sm text-slate-600">{strategyMeta.description}</p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="auto-max">Max auto promotions (phase)</Label>
              <Input
                id="auto-max"
                type="number"
                min={0}
                max={10}
                value={autoMax}
                onChange={(e) => setPhaseMax('AUTO_PROMOTIONS', Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-max">Max coupons (phase)</Label>
              <Input
                id="coupon-max"
                type="number"
                min={0}
                max={5}
                value={couponMax}
                onChange={(e) => setPhaseMax('COUPONS', Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Global tie-breakers (read-only order)</p>
            <div className="flex flex-wrap gap-2">
              {(scope === 'global'
                ? draft.priority.global.tieBreakers
                : draft.priority.domains?.[scope]?.tieBreakers ?? draft.priority.global.tieBreakers
              ).map((tb) => (
                <Badge key={tb} variant="secondary">
                  {TIE_BREAKER_OPTIONS.find((o) => o.value === tb)?.label ?? tb}
                </Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Tie-breaker reordering will be available when the policy API supports full PriorityConfiguration writes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
