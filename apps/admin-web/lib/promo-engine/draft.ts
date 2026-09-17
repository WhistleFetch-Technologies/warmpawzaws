import type { PromoEngineBasics, PromoEngineDraft, PromoEngineListItem } from './types';
import { toListItem } from './types';

export function validateBasicsDraft(basics: PromoEngineBasics): string[] {
  const errors: string[] = [];
  if (!basics.name.trim()) errors.push('Promotion name is required');
  if (basics.priority < 1 || basics.priority > 100) {
    errors.push('Priority must be between 1 and 100');
  }
  if (basics.startAt && basics.endAt && new Date(basics.endAt) < new Date(basics.startAt)) {
    errors.push('End date must be on or after start date');
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
    if (filters.status !== 'all' && row.status !== filters.status) return false;
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
