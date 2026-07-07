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
  Badge,
} from '@warmpawz/ui';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';
import { DomainScopeSelector } from '../shared/DomainScopeSelector';
import { CustomPriorityOrder } from '../shared/CustomPriorityOrder';
import { TIE_BREAKER_OPTIONS, WINNING_STRATEGY_OPTIONS } from '@/lib/discount-policy/option-registry';
import {
  ensureBusinessRules,
  getApplicationStrategyLabel,
  patchBusinessRules,
} from '@/lib/discount-policy/business-rules-mapper';
import type { WinningStrategyKey } from '@/lib/discount-policy/business-rules-types';
import { normalizeWinningStrategy } from '@/lib/discount-policy/business-rules-types';
import type { DiscountPolicyBundle, PolicyScope } from '@/lib/discount-policy/types';

export function PriorityConfigSection({
  draft,
  onChange,
}: {
  draft: DiscountPolicyBundle;
  onChange: (bundle: DiscountPolicyBundle) => void;
}) {
  const [scope, setScope] = useState<PolicyScope>('global');
  const rules = ensureBusinessRules(draft);
  const bestOfferOnly = rules.applicationStrategy === 'BEST_OFFER_ONLY';

  const autoMax =
    scope === 'global'
      ? draft.priority.global.phases.AUTO_PROMOTIONS?.maxSelected ?? 1
      : draft.priority.domains?.[scope]?.phases?.AUTO_PROMOTIONS?.maxSelected ??
        draft.priority.global.phases.AUTO_PROMOTIONS?.maxSelected ??
        1;

  const couponMax =
    scope === 'global'
      ? draft.priority.global.phases.COUPONS?.maxSelected ?? 1
      : draft.priority.domains?.[scope]?.phases?.COUPONS?.maxSelected ??
        draft.priority.global.phases.COUPONS?.maxSelected ??
        1;

  const winningStrategy = normalizeWinningStrategy(rules.winningStrategy);
  const strategyMeta = WINNING_STRATEGY_OPTIONS.find((o) => o.value === winningStrategy);

  const setWinningStrategy = (value: WinningStrategyKey) => {
    onChange(patchBusinessRules(draft, { winningStrategy: value }));
  };

  const setCustomOrder = (customPriorityOrder: string[]) => {
    onChange(patchBusinessRules(draft, { customPriorityOrder }));
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

  if (!bestOfferOnly) {
    return (
      <div className="space-y-6">
        <DomainScopeSelector scope={scope} onScopeChange={setScope} />
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Winning Strategy</CardTitle>
            <CardDescription>
              Determines which offer wins when multiple promotions or coupons are applicable.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-600">
              Current strategy:{' '}
              <strong>{getApplicationStrategyLabel(rules.applicationStrategy)}</strong>. Winning
              Strategy applies only when Discount Application is Best Offer Only.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DomainScopeSelector scope={scope} onScopeChange={setScope} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Winning Strategy</CardTitle>
            <CardDescription>
              Determines which offer wins when multiple promotions or coupons are applicable.
            </CardDescription>
          </div>
          <PolicyHelpButton docKey="discount-priority-policy" />
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="sr-only">Winning strategy</legend>
            {WINNING_STRATEGY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                  winningStrategy === option.value
                    ? 'border-violet-300 bg-violet-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="winningStrategy"
                  className="mt-1"
                  checked={winningStrategy === option.value}
                  onChange={() => setWinningStrategy(option.value)}
                />
                <span>
                  <span className="block text-sm font-medium text-slate-900">{option.label}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {strategyMeta ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {strategyMeta.description}
            </p>
          ) : null}

          {winningStrategy === 'CUSTOM_PRIORITY' ? (
            <div className="space-y-2 border-t pt-6">
              <Label>Custom priority order</Label>
              <CustomPriorityOrder
                order={rules.customPriorityOrder}
                offerTypes={rules.offerTypes}
                onChange={setCustomOrder}
              />
            </div>
          ) : null}

          <div className="grid gap-4 border-t pt-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="auto-max">Max auto promotions (phase)</Label>
              <Input
                id="auto-max"
                type="number"
                min={0}
                max={10}
                value={autoMax}
                disabled={bestOfferOnly}
                onChange={(e) => setPhaseMax('AUTO_PROMOTIONS', Number(e.target.value))}
              />
              {bestOfferOnly ? (
                <p className="text-xs text-slate-500">Locked to 1 when Best Offer Only is active.</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="coupon-max">Max coupons (phase)</Label>
              <Input
                id="coupon-max"
                type="number"
                min={0}
                max={5}
                value={couponMax}
                disabled={bestOfferOnly}
                onChange={(e) => setPhaseMax('COUPONS', Number(e.target.value))}
              />
              {bestOfferOnly ? (
                <p className="text-xs text-slate-500">Locked to 1 when Best Offer Only is active.</p>
              ) : null}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Tie-breakers (engine order)</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
