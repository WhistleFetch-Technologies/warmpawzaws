import type {
  CampaignRecurringRule,
  CampaignScheduleType,
  CommercialCampaignRecord,
} from './types';

export interface ScheduleResolution {
  scheduleType: CampaignScheduleType;
  startAt?: string | null;
  endAt?: string | null;
  recurringRule?: CampaignRecurringRule | null;
  /** Mirrors promotion start/end — reuse existing promotion scheduling fields. */
  promotionStartDate?: string;
  promotionEndDate?: string;
}

/**
 * Resolves campaign schedule into promotion-compatible dates.
 * Reuses promotion start_date/end_date — no separate EventBridge scheduler.
 */
export function resolveCampaignSchedule(input: {
  scheduleType?: CampaignScheduleType;
  startAt?: string | null;
  endAt?: string | null;
  recurringRule?: CampaignRecurringRule | null;
}): ScheduleResolution {
  const scheduleType = input.scheduleType ?? 'immediate';
  const now = new Date();

  if (scheduleType === 'immediate') {
    const start = now.toISOString();
    const end = input.endAt ?? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    return {
      scheduleType,
      startAt: start,
      endAt: end,
      promotionStartDate: start.split('T')[0],
      promotionEndDate: end.split('T')[0],
    };
  }

  if (scheduleType === 'scheduled') {
    const start = input.startAt ?? now.toISOString();
    const end =
      input.endAt ?? new Date(new Date(start).getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
    return {
      scheduleType,
      startAt: start,
      endAt: end,
      promotionStartDate: start.split('T')[0],
      promotionEndDate: end.split('T')[0],
    };
  }

  // recurring — promotion window for current cycle; full recurrence stored on campaign
  const start = input.startAt ?? now.toISOString();
  const end =
    input.endAt ?? new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  return {
    scheduleType,
    startAt: start,
    endAt: end,
    recurringRule: input.recurringRule ?? { frequency: 'weekly', daysOfWeek: [5, 6] },
    promotionStartDate: start.split('T')[0],
    promotionEndDate: end.split('T')[0],
  };
}

export function applyScheduleToCampaign(
  campaign: CommercialCampaignRecord,
  schedule: ScheduleResolution
): CommercialCampaignRecord {
  return {
    ...campaign,
    scheduleType: schedule.scheduleType,
    startAt: schedule.startAt,
    endAt: schedule.endAt,
    recurringRule: schedule.recurringRule ?? campaign.recurringRule,
  };
}
