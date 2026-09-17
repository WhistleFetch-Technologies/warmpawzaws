import { createEmptyDraft, toListItem, type PromoEngineDraft, type PromoEngineListItem } from './types';

export const PROMO_ENGINE_STORAGE_KEY = 'warmpawz.promo-engine.drafts.v1';

/**
 * Phase 1 persistence is local-only.
 * Abhi: replace load/save with GET/POST /admin/promo-engine/promotions.
 */
export function loadPromoEngineDrafts(): PromoEngineDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PROMO_ENGINE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PromoEngineDraft[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePromoEngineDrafts(drafts: PromoEngineDraft[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PROMO_ENGINE_STORAGE_KEY, JSON.stringify(drafts));
}

export function upsertPromoEngineDraft(draft: PromoEngineDraft): PromoEngineDraft[] {
  const next = loadPromoEngineDrafts();
  const idx = next.findIndex((d) => d.id === draft.id);
  if (idx >= 0) next[idx] = draft;
  else next.unshift(draft);
  savePromoEngineDrafts(next);
  return next;
}

export function newPromoEngineDraft(): PromoEngineDraft {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `draft-${Date.now()}`;
  return createEmptyDraft(id);
}

export function draftsToListItems(drafts: PromoEngineDraft[]): PromoEngineListItem[] {
  return drafts.map(toListItem);
}
