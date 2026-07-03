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
  Badge,
} from '@warmpawz/ui';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';
import { DomainScopeSelector } from '../shared/DomainScopeSelector';
import { STACK_SOURCE_OPTIONS } from '@/lib/discount-policy/option-registry';
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
  const stack = getStackGlobal(draft, scope);

  const patch = (patchObj: Partial<typeof draft.stack.global>) => {
    const next = structuredClone(draft);
    if (scope === 'global') {
      next.stack.global = { ...next.stack.global, ...patchObj };
    } else {
      next.stack.domains = next.stack.domains ?? {};
      next.stack.domains[scope] = { ...next.stack.domains[scope], ...patchObj };
    }
    onChange(next);
  };

  return (
    <div className="space-y-6">
      <DomainScopeSelector scope={scope} onScopeChange={setScope} />

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Stack behaviour</CardTitle>
            <CardDescription>
              Controls how promotions and coupons combine — no discount amounts are calculated here.
            </CardDescription>
          </div>
          <PolicyHelpButton docKey="discount-stack-policy" />
        </CardHeader>
        <CardContent className="space-y-6">
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
              <div key={key} className="flex items-center justify-between gap-4 rounded-lg border p-3">
                <Label htmlFor={key} className="text-sm">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={stack[key]}
                  onCheckedChange={(checked) => patch({ [key]: checked })}
                />
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label htmlFor="application-mode">Application mode default</Label>
            <Select
              value={stack.applicationModeDefault}
              onValueChange={(v) =>
                patch({ applicationModeDefault: v as 'SEQUENTIAL' | 'PARALLEL' })
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

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Stack order</p>
            <div className="flex flex-wrap gap-2">
              {stack.stackOrder.map((source, i) => (
                <Badge key={`${source}-${i}`} variant="outline">
                  {STACK_SOURCE_OPTIONS.find((o) => o.value === source)?.label ?? source}
                </Badge>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Custom stack rules ({draft.stack.global.stackRules.length} global) are managed via
            StackPolicyConfiguration.stackRules when the policy API is available.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
