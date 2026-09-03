'use client';

import React from 'react';

import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Input } from '@warmpawz/ui';
import type { CampaignScheduleType, CampaignRecurringRule } from '@/lib/commercial-campaign/types';

export function CampaignScheduleEditor({
  scheduleType,
  startAt,
  endAt,
  recurringRule,
  onChange,
  readOnly = false,
}: {
  scheduleType: CampaignScheduleType;
  startAt?: string;
  endAt?: string;
  recurringRule?: CampaignRecurringRule | null;
  onChange: (patch: {
    scheduleType?: CampaignScheduleType;
    startAt?: string;
    endAt?: string;
    recurringRule?: CampaignRecurringRule | null;
  }) => void;
  readOnly?: boolean;
}) {
  const toLocal = (iso?: string) => (iso ? iso.slice(0, 16) : '');
  const fromLocal = (v: string) => (v ? new Date(v).toISOString() : undefined);

  return (
    <div className="space-y-4 rounded-xl border bg-white p-4">
      <div>
        <h3 className="text-base font-semibold text-slate-900">Schedule</h3>
        <p className="text-sm text-slate-500">Immediate, scheduled, or recurring — same controls as promotions.</p>
      </div>
      <div className="space-y-2">
        <Label>Schedule type</Label>
        <Select
          value={scheduleType}
          disabled={readOnly}
          onValueChange={(v: string) => onChange({ scheduleType: v as CampaignScheduleType })}
        >
          <SelectTrigger className="bg-white sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="immediate">Immediate</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="recurring">Recurring</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scheduleType !== 'immediate' && !readOnly ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Start (local)</Label>
            <Input
              type="datetime-local"
              value={toLocal(startAt)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ startAt: fromLocal(e.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label>End (local)</Label>
            <Input
              type="datetime-local"
              value={toLocal(endAt)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange({ endAt: fromLocal(e.target.value) })}
            />
          </div>
        </div>
      ) : null}

      {scheduleType === 'recurring' && !readOnly ? (
        <div className="space-y-2">
          <Label>Frequency</Label>
          <Select
            value={recurringRule?.frequency ?? 'weekly'}
            onValueChange={(v: string) =>
              onChange({
                recurringRule: {
                  ...(recurringRule ?? { frequency: 'weekly' }),
                  frequency: v as CampaignRecurringRule['frequency'],
                },
              })
            }
          >
            <SelectTrigger className="bg-white sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}

      <p className="text-xs text-slate-500">Timezone: Asia/Kolkata (server default)</p>
    </div>
  );
}
