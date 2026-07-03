import { CAMPAIGN_LIFECYCLE_TRANSITIONS } from './campaign-configuration';
import type { CampaignLifecycleStatus } from './types';

export function canTransitionLifecycle(
  from: CampaignLifecycleStatus,
  to: CampaignLifecycleStatus
): boolean {
  const allowed = CAMPAIGN_LIFECYCLE_TRANSITIONS[from] ?? [];
  return allowed.includes(to);
}

export function assertLifecycleTransition(
  from: CampaignLifecycleStatus,
  to: CampaignLifecycleStatus
): void {
  if (!canTransitionLifecycle(from, to)) {
    throw new Error(`Invalid campaign lifecycle transition: ${from} → ${to}`);
  }
}

export function deriveLifecycleFromSchedule(input: {
  status: CampaignLifecycleStatus;
  startAt?: string | null;
  endAt?: string | null;
  now?: Date;
}): CampaignLifecycleStatus {
  const now = input.now ?? new Date();
  if (input.status === 'scheduled' && input.startAt) {
    const start = new Date(input.startAt);
    if (start <= now) return 'running';
  }
  if (input.status === 'running' && input.endAt) {
    const end = new Date(input.endAt);
    if (end < now) return 'expired';
  }
  return input.status;
}

export function isCampaignActiveStatus(status: CampaignLifecycleStatus): boolean {
  return status === 'running' || status === 'scheduled';
}
