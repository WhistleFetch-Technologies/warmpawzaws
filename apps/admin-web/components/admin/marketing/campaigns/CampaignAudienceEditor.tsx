'use client';

import React from 'react';

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input } from '@warmpawz/ui';
import { AUDIENCE_OPTIONS, type CampaignAudience } from '@/lib/commercial-campaign/types';

export function CampaignAudienceEditor({
  audience,
  onChange,
  readOnly = false,
}: {
  audience: CampaignAudience;
  onChange: (a: CampaignAudience) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Audience</h3>
        <p className="text-sm text-slate-500">Reuses promotion targeting kinds — no duplicate selector.</p>
      </div>
      <div className="space-y-2">
        <Label>Target audience</Label>
        <Select
          value={audience.kind}
          disabled={readOnly}
          onValueChange={(v: string) => onChange({ ...audience, kind: v as CampaignAudience['kind'] })}
        >
          <SelectTrigger className="bg-white sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {audience.kind === 'segment' && !readOnly ? (
        <div className="space-y-2">
          <Label>Segment IDs (comma-separated)</Label>
          <Input
            value={(audience.segmentIds ?? []).join(', ')}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              onChange({
                ...audience,
                segmentIds: e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean),
              })
            }
            placeholder="seg_1, seg_2"
          />
        </div>
      ) : null}

      {audience.kind === 'vendor_customers' && !readOnly ? (
        <div className="space-y-2">
          <Label>Vendor ID</Label>
          <Input
            value={audience.vendorId ?? ''}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...audience, vendorId: e.target.value || undefined })}
          />
        </div>
      ) : null}
    </div>
  );
}
