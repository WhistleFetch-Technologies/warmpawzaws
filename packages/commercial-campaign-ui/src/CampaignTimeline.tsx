'use client';

import {
  CAMPAIGN_LIFECYCLE_LABELS,
  CAMPAIGN_TIMELINE_STEPS,
  type CampaignLifecycleStatus,
  type CommercialCampaignRecord,
} from './types';

function timelineEvents(campaign: CommercialCampaignRecord): Array<{
  status: string;
  at?: string;
}> {
  const fromMeta = campaign.metadata?.timeline;
  if (Array.isArray(fromMeta) && fromMeta.length) {
    return fromMeta.map((e) => {
      const row = e as { status?: string; at?: string };
      return { status: String(row.status ?? ''), at: row.at };
    });
  }
  return [{ status: 'draft', at: campaign.createdAt }, { status: campaign.status, at: campaign.updatedAt }];
}

export function CampaignTimeline({ campaign }: { campaign: CommercialCampaignRecord }) {
  const events = timelineEvents(campaign);
  const reached = new Set(events.map((e) => e.status));
  reached.add(campaign.status);

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-semibold text-slate-800">Campaign timeline</h4>
      <ol className="relative space-y-0 border-l border-slate-200 pl-4">
        {CAMPAIGN_TIMELINE_STEPS.map((step) => {
          const active = reached.has(step) || campaign.status === step;
          const event = [...events].reverse().find((e) => e.status === step);
          return (
            <li key={step} className="relative pb-4 last:pb-0">
              <span
                className={`absolute -left-[21px] mt-1 h-2.5 w-2.5 rounded-full border ${
                  active ? 'border-orange-500 bg-orange-500' : 'border-slate-300 bg-white'
                }`}
              />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className={`text-sm font-medium ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {CAMPAIGN_LIFECYCLE_LABELS[step as CampaignLifecycleStatus] ?? step}
                </span>
                {event?.at ? (
                  <span className="text-xs text-slate-500">{new Date(event.at).toLocaleString()}</span>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
      {campaign.status === 'cancelled' || campaign.status === 'expired' ? (
        <p className="text-xs text-slate-500">
          Current terminal state: {CAMPAIGN_LIFECYCLE_LABELS[campaign.status]}
        </p>
      ) : null}
    </div>
  );
}
