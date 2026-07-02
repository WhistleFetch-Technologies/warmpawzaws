import type { NormalizedCouponItem, NormalizedPromotionItem, VisualLifecycle } from './types';

type LifecycleInput = {
  isActive: boolean;
  startDate: string;
  endDate: string;
  published?: boolean;
  uiStatus?: VisualLifecycle;
};

export function resolveVisualLifecycle(
  input: LifecycleInput,
  now: Date = new Date()
): VisualLifecycle {
  if (input.uiStatus === 'draft' || input.uiStatus === 'archived') {
    return input.uiStatus;
  }
  if (!input.isActive) {
    const end = new Date(input.endDate);
    if (now > end) return 'expired';
    return 'paused';
  }
  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (now < start) return 'scheduled';
  if (now > end) return 'expired';
  if (input.published === false) return 'draft';
  return 'active';
}

export function lifecycleFromPromotion(p: NormalizedPromotionItem, now?: Date): VisualLifecycle {
  return resolveVisualLifecycle(
    {
      isActive: p.isActive,
      startDate: p.startDate,
      endDate: p.endDate,
      published: p.published,
    },
    now
  );
}

export function lifecycleFromCoupon(c: NormalizedCouponItem, now?: Date): VisualLifecycle {
  return resolveVisualLifecycle(
    {
      isActive: c.isActive,
      startDate: c.startDate,
      endDate: c.endDate,
    },
    now
  );
}

export const LIFECYCLE_LABELS: Record<VisualLifecycle, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  active: 'Active',
  paused: 'Paused',
  expired: 'Expired',
  archived: 'Archived',
};

export const LIFECYCLE_COLORS: Record<VisualLifecycle, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  paused: 'bg-amber-50 text-amber-800 border-amber-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
  archived: 'bg-violet-50 text-violet-700 border-violet-200',
};
