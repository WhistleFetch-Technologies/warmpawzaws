'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Input,
  Switch,
  Button,
} from '@warmpawz/ui';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';
import { CommercialHelpTooltip } from '@/components/admin/commercial-ai/CommercialHelpTooltip';
import { FUNDING_PRESET_SPLITS } from '@/lib/discount-policy/option-registry';
import type { DiscountPolicyBundle } from '@/lib/discount-policy/types';

export function FundingConfigSection({
  draft,
  onChange,
}: {
  draft: DiscountPolicyBundle;
  onChange: (bundle: DiscountPolicyBundle) => void;
}) {
  const { funding } = draft;
  const split = funding.sharedDefaultSplit;

  const applyPreset = (platformPercent: number, vendorPercent: number) => {
    const next = structuredClone(draft);
    next.funding.sharedDefaultSplit = { platformPercent, vendorPercent };
    onChange(next);
  };

  const patchFunding = (patch: Partial<typeof funding>) => {
    onChange({ ...structuredClone(draft), funding: { ...funding, ...patch } });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="text-lg">Default funding split</CardTitle>
            <CardDescription>
              Configures shared funding defaults passed to the Settlement Engine — no payout math in UI.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            <CommercialHelpTooltip glossaryId="funding" />
            <PolicyHelpButton docKey="discount-funding-policy" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {FUNDING_PRESET_SPLITS.map((p) => (
              <Button
                key={p.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => applyPreset(p.platformPercent, p.vendorPercent)}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="platform-pct">Platform %</Label>
              <Input
                id="platform-pct"
                type="number"
                min={0}
                max={100}
                value={split.platformPercent}
                onChange={(e) =>
                  applyPreset(Number(e.target.value), split.vendorPercent)
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vendor-pct">Vendor %</Label>
              <Input
                id="vendor-pct"
                type="number"
                min={0}
                max={100}
                value={split.vendorPercent}
                onChange={(e) =>
                  applyPreset(split.platformPercent, Number(e.target.value))
                }
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <Label htmlFor="block-vendor-platform" className="text-sm">
                Block vendor-funded + platform coupon
              </Label>
              <Switch
                id="block-vendor-platform"
                checked={Boolean(funding.blockVendorFundedWithPlatformCoupon)}
                onCheckedChange={(v) => patchFunding({ blockVendorFundedWithPlatformCoupon: v })}
              />
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <Label htmlFor="block-shared-platform" className="text-sm">
                Block shared + platform coupon
              </Label>
              <Switch
                id="block-shared-platform"
                checked={Boolean(funding.blockSharedWithPlatformCoupon)}
                onCheckedChange={(v) => patchFunding({ blockSharedWithPlatformCoupon: v })}
              />
            </div>
          </div>

          <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
            <p className="font-medium text-slate-700">Campaign override</p>
            <p className="mt-1">
              Per-campaign funding is configured in the Commercial Campaign Engine (Phase 10).
              Campaign-level overrides will appear here when the policy bundle API supports campaign scopes.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
