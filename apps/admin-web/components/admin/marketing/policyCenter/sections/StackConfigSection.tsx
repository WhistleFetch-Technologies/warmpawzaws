'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Button,
} from '@warmpawz/ui';
import { ChevronDown } from 'lucide-react';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';
import { DomainScopeSelector } from '../shared/DomainScopeSelector';
import { OfferCombinationMatrix } from '../shared/OfferCombinationMatrix';
import { APPLICATION_STRATEGY_OPTIONS } from '@/lib/discount-policy/option-registry';
import {
  ensureBusinessRules,
  patchBusinessRules,
} from '@/lib/discount-policy/business-rules-mapper';
import type { DiscountApplicationStrategy } from '@/lib/discount-policy/business-rules-types';
import type { DiscountPolicyBundle, PolicyScope } from '@/lib/discount-policy/types';

function getStackGlobal(draft: DiscountPolicyBundle, scope: PolicyScope) {
  if (scope === 'global') return draft.stack.global;
  return { ...draft.stack.global, ...draft.stack.domains?.[scope] };
}

export function StackConfigSection({
  draft,
  onChange,
}: {
  draft: DiscountPolicyBundle;
  onChange: (bundle: DiscountPolicyBundle) => void;
}) {
  const [scope, setScope] = useState<PolicyScope>('global');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const rules = ensureBusinessRules(draft);
  const stack = getStackGlobal(draft, scope);
  const strategyMeta = APPLICATION_STRATEGY_OPTIONS.find(
    (o) => o.value === rules.applicationStrategy
  );

  const setApplicationStrategy = (strategy: DiscountApplicationStrategy) => {
    onChange(patchBusinessRules(draft, { applicationStrategy: strategy }));
  };

  const setMatrix = (combinationMatrix: typeof rules.combinationMatrix) => {
    onChange(patchBusinessRules(draft, { combinationMatrix }));
  };

  const patchStack = (patchObj: Partial<typeof draft.stack.global>) => {
    const next = structuredClone(draft);
    if (scope === 'global') {
      next.stack.global = { ...next.stack.global, ...patchObj };
    } else {
      next.stack.domains = next.stack.domains ?? {};
      next.stack.domains[scope] = { ...next.stack.domains[scope], ...patchObj };
    }
    onChange(next);
  };

  const matrixReadOnly = rules.applicationStrategy === 'BEST_OFFER_ONLY';

  return (
    <div className="space-y-6">
      <DomainScopeSelector scope={scope} onScopeChange={setScope} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Discount Application Strategy</CardTitle>
            <CardDescription>
              Controls how promotions and coupons combine on a transaction — no discount amounts are
              calculated here.
            </CardDescription>
          </div>
          <PolicyHelpButton docKey="discount-stack-policy" />
        </CardHeader>
        <CardContent className="space-y-6">
          <fieldset className="space-y-3">
            <legend className="sr-only">Discount application strategy</legend>
            {APPLICATION_STRATEGY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex cursor-pointer gap-3 rounded-lg border p-4 transition-colors ${
                  rules.applicationStrategy === option.value
                    ? 'border-violet-300 bg-violet-50/50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <input
                  type="radio"
                  name="applicationStrategy"
                  className="mt-1"
                  checked={rules.applicationStrategy === option.value}
                  onChange={() => setApplicationStrategy(option.value)}
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Offer Combination Rules</CardTitle>
          <CardDescription>
            Matrix of which offer types may apply together. When Apply Best Offer Only is active,
            combinations are resolved by the Winning Offer Strategy.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OfferCombinationMatrix
            matrix={rules.combinationMatrix}
            offerTypes={rules.offerTypes}
            readOnly={matrixReadOnly}
            onChange={setMatrix}
          />
        </CardContent>
      </Card>

      {rules.applicationStrategy === 'CUSTOM_RULES' ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg">Advanced engine settings</CardTitle>
              <CardDescription>
                Low-level stack flags for Custom Rules mode. Prefer business rules when possible.
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => setAdvancedOpen((o) => !o)}>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
              />
            </Button>
          </CardHeader>
          {advancedOpen ? (
            <CardContent className="space-y-6 border-t pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {(
                    [
                      ['allowCouponWithPromotion', 'Allow coupon with promotion'],
                      ['allowMultipleCoupons', 'Allow multiple coupons'],
                      ['allowMultipleVendorPromotions', 'Allow multiple vendor promotions'],
                      ['allowPlatformWithVendor', 'Allow platform + vendor'],
                      ['exclusiveSkipsCouponPhase', 'Exclusive skips coupon phase'],
                      ['exclusiveTerminatesAll', 'Exclusive terminates all'],
                    ] as const
                  ).map(([key, label]) => (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-4 rounded-lg border p-3"
                    >
                      <Label htmlFor={key} className="text-sm">
                        {label}
                      </Label>
                      <Switch
                        id={key}
                        checked={stack[key]}
                        onCheckedChange={(checked) => patchStack({ [key]: checked })}
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="application-mode">Application mode default</Label>
                  <Select
                    value={stack.applicationModeDefault}
                    onValueChange={(v) =>
                      patchStack({ applicationModeDefault: v as 'SEQUENTIAL' | 'PARALLEL' })
                    }
                  >
                    <SelectTrigger id="application-mode" className="bg-white sm:w-64">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SEQUENTIAL">Sequential</SelectItem>
                      <SelectItem value="PARALLEL" disabled>
                        Parallel (future)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
