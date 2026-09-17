import { apiClient } from '@/lib/api-client';
import type {
  PromoEngineDraft,
  PromoEngineListItem,
  PromoEngineStatus,
} from './types';
import { createEmptyDraft } from './types';

const BASE = '/admin/promo-engine/promotions';

export async function fetchPromoEngineList(filters?: {
  status?: string;
  service?: string;
  q?: string;
}): Promise<PromoEngineListItem[]> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set('status', filters.status);
  if (filters?.service && filters.service !== 'all') params.set('service', filters.service);
  if (filters?.q) params.set('q', filters.q);
  const q = params.toString() ? `?${params}` : '';
  const res = await apiClient.get<{ success?: boolean; promotions?: PromoEngineListItem[] }>(
    `${BASE}${q}`
  );
  return res.promotions ?? [];
}

export async function fetchPromoEngineDetail(id: string): Promise<PromoEngineDraft | null> {
  const res = await apiClient.get<{ success?: boolean; promotion?: Record<string, unknown> }>(
    `${BASE}/${id}`
  );
  const p = res.promotion;
  if (!p) return null;
  return mapApiPromotionToDraft(p);
}

export async function createPromoEnginePromotion(
  draft: PromoEngineDraft
): Promise<PromoEngineDraft> {
  const res = await apiClient.post<{ success?: boolean; promotion?: Record<string, unknown> }>(
    BASE,
    draftToApiBody(draft)
  );
  if (!res.promotion) throw new Error('Create failed');
  return mapApiPromotionToDraft(res.promotion);
}

export async function updatePromoEnginePromotion(
  draft: PromoEngineDraft
): Promise<PromoEngineDraft> {
  const res = await apiClient.put<{ success?: boolean; promotion?: Record<string, unknown> }>(
    `${BASE}/${draft.id}`,
    draftToApiBody(draft)
  );
  if (!res.promotion) throw new Error('Update failed');
  return mapApiPromotionToDraft(res.promotion);
}

export async function patchPromoEngineStatus(
  id: string,
  status: PromoEngineStatus
): Promise<void> {
  await apiClient.patch(`${BASE}/${id}/status`, { status });
}

function draftToApiBody(draft: PromoEngineDraft): Record<string, unknown> {
  return {
    status: draft.status,
    basics: draft.basics,
    conditionJson: draft.conditionJson,
    benefitJson: draft.benefitJson,
    ruleType: draft.ruleType,
  };
}

function mapApiPromotionToDraft(p: Record<string, unknown>): PromoEngineDraft {
  const basics = (p.basics as PromoEngineDraft['basics']) || createEmptyDraft(String(p.id)).basics;
  return {
    id: String(p.id),
    status: (p.status as PromoEngineStatus) || 'DRAFT',
    basics: {
      ...createEmptyDraft(String(p.id)).basics,
      ...basics,
      name: basics.name || String(p.name || ''),
      code: basics.code || String(p.code || ''),
      serviceCategories: (basics.serviceCategories ||
        (p.service_categories as PromoEngineDraft['basics']['serviceCategories']) ||
        []) as PromoEngineDraft['basics']['serviceCategories'],
    },
    conditionJson:
      (p.conditionJson as PromoEngineDraft['conditionJson']) ||
      ({ operator: 'AND', conditions: [] } as PromoEngineDraft['conditionJson']),
    benefitJson: (p.benefitJson as PromoEngineDraft['benefitJson']) || [],
    ruleType: (p.ruleType as PromoEngineDraft['ruleType']) || 'GENERIC',
    createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
    updatedAt: String(p.updated_at || p.updatedAt || new Date().toISOString()),
  };
}
