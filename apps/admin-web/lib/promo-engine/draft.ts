import type {
  PromoCustomerCopy,
  PromoEngineBasics,
  PromoEngineDraft,
  PromoEngineListItem,
} from './types';
import {
  effectivePromoStatus,
  PROMO_CUSTOMER_COPY_FIELDS,
  PROMO_CUSTOMER_COPY_MAX_LENGTH,
  PROMO_CUSTOMER_COPY_PLACEHOLDERS,
  toListItem,
} from './types';
import { istLocalToEpochMs } from './datetime';

export function validateBasicsDraft(basics: PromoEngineBasics): string[] {
  const errors: string[] = [];
  if (!basics.name.trim()) errors.push('Promotion name is required');
  if (basics.priority < 1 || basics.priority > 100) {
    errors.push('Priority must be between 1 and 100');
  }
  if (basics.startAt && basics.endAt && istLocalToEpochMs(basics.endAt) <= istLocalToEpochMs(basics.startAt)) {
    errors.push('End date must be after start date');
  }
  if (basics.fundingType === 'SHARED') {
    const sum = basics.fundingSplit.warmpawzPercent + basics.fundingSplit.vendorPercent;
    if (sum !== 100) errors.push('Shared funding split must add up to 100%');
  }
  if (basics.commercialCampaignId.trim()) {
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuid.test(basics.commercialCampaignId.trim())) {
      errors.push('Campaign link must be a valid UUID or left empty');
    }
  }
  return errors;
}

/** Blocks going live with an end date that has already passed. */
export function validateGoLiveSchedule(basics: PromoEngineBasics, now: Date = new Date()): string[] {
  if (!basics.endAt) return [];
  const end = istLocalToEpochMs(basics.endAt);
  return Number.isFinite(end) && end <= now.getTime()
    ? ['End date is in the past — extend it before activating']
    : [];
}

export function validateCustomerCopyDraft(copy: PromoCustomerCopy | undefined): string[] {
  if (!copy) return [];
  const allowed = new Set<string>(PROMO_CUSTOMER_COPY_PLACEHOLDERS);
  const errors: string[] = [];
  for (const field of PROMO_CUSTOMER_COPY_FIELDS) {
    const value = copy[field.key]?.trim();
    if (!value) continue;
    if (value.length > PROMO_CUSTOMER_COPY_MAX_LENGTH) {
      errors.push(`${field.label}: max ${PROMO_CUSTOMER_COPY_MAX_LENGTH} characters`);
    }
    for (const m of value.matchAll(/\{(\w+)\}/g)) {
      if (!allowed.has(m[1])) errors.push(`${field.label}: unknown placeholder {${m[1]}}`);
    }
  }
  return errors;
}

export function validateLimitsDraft(limits: PromoEngineDraft['limits']): string[] {
  if (!limits) return [];
  const errors: string[] = [];
  const counts: Array<[keyof NonNullable<PromoEngineDraft['limits']>, string]> = [
    ['perUser', 'Per user'],
    ['perTransaction', 'Max applications per transaction'],
    ['dailyLimit', 'Daily limit'],
    ['campaignLimit', 'Campaign limit'],
  ];
  for (const [key, label] of counts) {
    const v = limits[key];
    if (v == null) continue;
    if (!Number.isInteger(v) || v < 0) errors.push(`${label} must be a whole number (0 or more)`);
  }
  if (limits.budgetLimit != null && (!Number.isFinite(limits.budgetLimit) || limits.budgetLimit < 0)) {
    errors.push('Budget must be 0 or more');
  }
  return errors;
}

export interface PromoEngineListFilters {
  query: string;
  status: string;
  service: string;
  type: string;
}

export function filterPromoEngineRows(
  rows: PromoEngineListItem[],
  filters: PromoEngineListFilters,
): PromoEngineListItem[] {
  const q = filters.query.trim().toLowerCase();
  return rows.filter((row) => {
    if (q) {
      const hay = `${row.name} ${row.code} ${row.id}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (filters.status !== 'all' && effectivePromoStatus(row) !== filters.status) return false;
    if (filters.service !== 'all' && !row.serviceCategories.includes(filters.service as PromoEngineListItem['serviceCategories'][number])) {
      return false;
    }
    if (filters.type !== 'all' && row.ruleType !== filters.type) return false;
    return true;
  });
}

export function applyBasicsToDraft(draft: PromoEngineDraft, basics: PromoEngineBasics): PromoEngineDraft {
  return {
    ...draft,
    basics: {
      ...basics,
      name: basics.name.trim(),
      code: basics.code.trim(),
      commercialCampaignId: basics.commercialCampaignId.trim(),
    },
    updatedAt: new Date().toISOString(),
  };
}
