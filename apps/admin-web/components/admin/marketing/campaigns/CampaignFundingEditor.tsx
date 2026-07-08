'use client';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Label,
  Input,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import { FUNDING_PRESET_SPLITS } from '@/lib/discount-policy/option-registry';
import type { CampaignFundingPolicy } from '@/lib/commercial-campaign/types';
import { CommercialHelpTooltip } from '@/components/admin/commercial-ai/CommercialHelpTooltip';

export function CampaignFundingEditor({
  funding,
  onChange,
  readOnly = false,
}: {
  funding: CampaignFundingPolicy;
  onChange: (f: CampaignFundingPolicy) => void;
  readOnly?: boolean;
}) {
  const split = funding.split ?? { platformPercent: 50, vendorPercent: 50 };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-lg">
          Campaign funding
          <CommercialHelpTooltip glossaryId="funding" />
        </CardTitle>
        <CardDescription>
          Passed to Settlement Engine at orchestration — UI never calculates payouts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Funding type</Label>
          <Select
            value={funding.type}
            disabled={readOnly}
            onValueChange={(v) =>
              onChange({ ...funding, type: v as CampaignFundingPolicy['type'] })
            }
          >
            <SelectTrigger className="bg-white sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PLATFORM">100% Platform</SelectItem>
              <SelectItem value="VENDOR">100% Vendor</SelectItem>
              <SelectItem value="SHARED">Shared</SelectItem>
              <SelectItem value="CUSTOM">Custom split</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(funding.type === 'SHARED' || funding.type === 'CUSTOM') && !readOnly ? (
          <>
            <div className="flex flex-wrap gap-2">
              {FUNDING_PRESET_SPLITS.map((p) => (
                <Button
                  key={p.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...funding,
                      split: { platformPercent: p.platformPercent, vendorPercent: p.vendorPercent },
                    })
                  }
                >
                  {p.label}
                </Button>
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Platform %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={split.platformPercent}
                  onChange={(e) =>
                    onChange({
                      ...funding,
                      split: { platformPercent: Number(e.target.value), vendorPercent: split.vendorPercent },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Vendor %</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={split.vendorPercent}
                  onChange={(e) =>
                    onChange({
                      ...funding,
                      split: { platformPercent: split.platformPercent, vendorPercent: Number(e.target.value) },
                    })
                  }
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="rounded-lg border border-dashed bg-slate-50 p-3 text-sm text-slate-600">
          Settlement preview is read-only and available after orchestration on the Settlement tab.
        </div>
      </CardContent>
    </Card>
  );
}
