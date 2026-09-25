'use client';

import React from 'react';
import {
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@warmpawz/ui';
import {
  FUNDING_TYPES,
  STACKING_POLICIES,
  type PromoEngineBasics,
  type PromoFundingType,
  type StackingPolicy,
} from '@/lib/promo-engine/types';

export function BasicsStep({
  basics,
  onChange,
}: {
  basics: PromoEngineBasics;
  onChange: (next: PromoEngineBasics) => void;
}) {
  const patch = (partial: Partial<PromoEngineBasics>) => onChange({ ...basics, ...partial });

  return (
    <div className="space-y-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="promo-engine-name">Promotion name</Label>
          <Input
            id="promo-engine-name"
            value={basics.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patch({ name: e.target.value })}
            placeholder="Grooming Win Back"
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-engine-code">Code (optional)</Label>
          <Input
            id="promo-engine-code"
            value={basics.code}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patch({ code: e.target.value })}
            placeholder="PROMO-GRM-001"
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-engine-priority">Priority (1–100)</Label>
          <Input
            id="promo-engine-priority"
            type="number"
            min={1}
            max={100}
            value={basics.priority}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              patch({ priority: Number(e.target.value) })
            }
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-engine-start">Start</Label>
          <Input
            id="promo-engine-start"
            type="datetime-local"
            value={basics.startAt}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patch({ startAt: e.target.value })}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="promo-engine-end">End</Label>
          <Input
            id="promo-engine-end"
            type="datetime-local"
            value={basics.endAt}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => patch({ endAt: e.target.value })}
            className="min-h-11"
          />
        </div>
        <div className="space-y-2">
          <Label>Funding</Label>
          <Select
            value={basics.fundingType}
            onValueChange={(v: string) => patch({ fundingType: v as PromoFundingType })}
          >
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FUNDING_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type === 'WARMPAWZ' ? 'Warmpawz' : type === 'VENDOR' ? 'Vendor' : 'Shared'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Stacking policy</Label>
          <Select
            value={basics.stackingPolicy}
            onValueChange={(v: string) => patch({ stackingPolicy: v as StackingPolicy })}
          >
            <SelectTrigger className="min-h-11 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STACKING_POLICIES.map((policy) => (
                <SelectItem key={policy} value={policy}>
                  {policy.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {basics.fundingType === 'SHARED' ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="promo-engine-wp-split">Warmpawz %</Label>
            <Input
              id="promo-engine-wp-split"
              type="number"
              min={0}
              max={100}
              value={basics.fundingSplit.warmpawzPercent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                patch({
                  fundingSplit: {
                    warmpawzPercent: Number(e.target.value),
                    vendorPercent: basics.fundingSplit.vendorPercent,
                  },
                })
              }
              className="min-h-11"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="promo-engine-vendor-split">Vendor %</Label>
            <Input
              id="promo-engine-vendor-split"
              type="number"
              min={0}
              max={100}
              value={basics.fundingSplit.vendorPercent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                patch({
                  fundingSplit: {
                    warmpawzPercent: basics.fundingSplit.warmpawzPercent,
                    vendorPercent: Number(e.target.value),
                  },
                })
              }
              className="min-h-11"
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="promo-engine-campaign">Commercial campaign ID (optional)</Label>
        <Input
          id="promo-engine-campaign"
          value={basics.commercialCampaignId}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            patch({ commercialCampaignId: e.target.value })
          }
          placeholder="UUID from Campaigns tab"
          className="min-h-11"
        />
        <p className="text-xs text-slate-500">
          Links this engine promo to an existing commercial campaign. Leave empty if none.
        </p>
      </div>
    </div>
  );
}
