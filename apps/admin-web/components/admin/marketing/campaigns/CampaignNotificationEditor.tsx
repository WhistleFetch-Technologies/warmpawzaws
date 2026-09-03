'use client';

import { useEffect, useState } from 'react';
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';
import { listNotificationCampaigns } from '@/lib/commercial-campaign/commercial-campaign-api';
import type { CampaignNotificationMode } from '@/lib/commercial-campaign/types';
import { ComingSoonPanel } from '../policyCenter/shared/ApiPendingBanner';

export function CampaignNotificationEditor({
  mode,
  notificationCampaignId,
  onChange,
  readOnly = false,
}: {
  mode: CampaignNotificationMode;
  notificationCampaignId?: string | null;
  onChange: (patch: { notificationMode?: CampaignNotificationMode; notificationCampaignId?: string | null }) => void;
  readOnly?: boolean;
}) {
  const [campaigns, setCampaigns] = useState<Array<{ id: string; name?: string; status?: string }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode !== 'link') return;
    setLoading(true);
    void listNotificationCampaigns()
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }, [mode]);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Notifications</h3>
        <p className="text-sm text-slate-500">Link existing Notification Engine campaigns — no duplicate builder.</p>
      </div>
      <div className="space-y-2">
        <Label>Notification mode</Label>
        <Select
          value={mode}
          disabled={readOnly}
          onValueChange={(v: string) => onChange({ notificationMode: v as CampaignNotificationMode })}
        >
          <SelectTrigger className="bg-white sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="skip">No notification</SelectItem>
            <SelectItem value="link">Link existing campaign</SelectItem>
            <SelectItem value="create" disabled>
              Create notification (Coming Soon)
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {mode === 'create' ? (
        <ComingSoonPanel
          title="Create notification from campaign"
          description="Backend orchestration for inline notification creation is not exposed yet. Use Link existing or manage via Notification Engine."
          apiPath="POST /admin/commercial-campaigns/:id/orchestrate (notification bridge)"
        />
      ) : null}

      {mode === 'link' && !readOnly ? (
        <div className="space-y-2">
          <Label>Notification campaign</Label>
          <Select
            value={notificationCampaignId ?? ''}
            onValueChange={(v: string) => onChange({ notificationCampaignId: v || null })}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder={loading ? 'Loading…' : 'Select campaign'} />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name ?? c.id}
                  {c.status ? ` (${c.status})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
