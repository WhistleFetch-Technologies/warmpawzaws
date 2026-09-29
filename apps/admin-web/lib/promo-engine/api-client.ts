import { apiClient } from '@/lib/api-client';
import { toDatetimeLocalIst } from './datetime';
import type {
  PromoCustomerCopy,
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
  // EXPIRED includes past-end ACTIVE/PAUSED rows, so it is filtered client-side.
  if (filters?.status && filters.status !== 'all' && filters.status !== 'EXPIRED') {
    params.set('status', filters.status);
  }
  if (filters?.service && filters.service !== 'all') params.set('service', filters.service);
  if (filters?.q) params.set('q', filters.q);
  const q = params.toString() ? `?${params}` : '';
  const res = await apiClient.get<{ success?: boolean; promotions?: Array<Record<string, unknown>> }>(
    `${BASE}${q}`
  );
  return (res.promotions ?? []).map(mapApiListItem);
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

export async function evaluatePromoEngine(body: {
  user_id: string;
  transaction: Record<string, unknown>;
  behaviour_override?: Record<string, unknown>;
}): Promise<{
  eligible: boolean;
  evaluation_id: string;
  benefits: Array<{ benefit_type: string; amount: number; promotion_id: string }>;
  summary: { gross_amount: number; discount: number; payable: number; cashback: number };
  explain?: { failures?: unknown[]; matched_promotions?: string[] };
}> {
  return apiClient.post('/promo-engine/evaluate', body);
}

export function cleanCustomerCopy(copy: PromoCustomerCopy | undefined): PromoCustomerCopy | undefined {
  if (!copy) return undefined;
  const out: PromoCustomerCopy = {};
  for (const [k, v] of Object.entries(copy)) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (s) out[k as keyof PromoCustomerCopy] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

export function draftToApiBody(draft: PromoEngineDraft): Record<string, unknown> {
  const customerCopy = cleanCustomerCopy(draft.customerCopy);
  const metadata: Record<string, unknown> = {};
  if (draft.vcf) metadata.vcf = draft.vcf;
  if (customerCopy) metadata.customerCopy = customerCopy;
  return {
    status: draft.status,
    basics: draft.basics,
    conditionJson: draft.conditionJson,
    benefitJson: draft.benefitJson,
    ruleType: draft.ruleType,
    vcf: draft.vcf,
    customerCopy: customerCopy ?? null,
    metadata: Object.keys(metadata).length ? metadata : undefined,
    limits: draft.limits
      ? {
          per_user: draft.limits.perUser ?? null,
          per_transaction: draft.limits.perTransaction ?? null,
          daily_limit: draft.limits.dailyLimit ?? null,
          campaign_limit: draft.limits.campaignLimit ?? null,
          budget_limit: draft.limits.budgetLimit ?? null,
        }
      : undefined,
  };
}

function mapApiListItem(p: Record<string, unknown>): PromoEngineListItem {
  const services = (p.serviceCategories || p.service_categories || []) as PromoEngineListItem['serviceCategories'];
  return {
    id: String(p.id),
    name: String(p.name || 'Untitled'),
    code: String(p.code || ''),
    status: (p.status as PromoEngineStatus) || 'DRAFT',
    serviceCategories: Array.isArray(services) ? services : [],
    ruleType: (p.ruleType || p.rule_type || 'GENERIC') as PromoEngineListItem['ruleType'],
    fundingType: (p.fundingType || p.funding_type || 'WARMPAWZ') as PromoEngineListItem['fundingType'],
    usageCount: Number(p.usageCount ?? p.usage_count ?? 0),
    startAt: toDatetimeLocalIst(p.startAt || p.start_at),
    endAt: toDatetimeLocalIst(p.endAt || p.end_at),
    updatedAt: String(p.updatedAt || p.updated_at || ''),
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
      startAt: toDatetimeLocalIst(basics.startAt || p.start_at || p.startAt),
      endAt: toDatetimeLocalIst(basics.endAt || p.end_at || p.endAt),
      serviceCategories: (basics.serviceCategories ||
        (p.service_categories as PromoEngineDraft['basics']['serviceCategories']) ||
        []) as PromoEngineDraft['basics']['serviceCategories'],
    },
    conditionJson:
      (p.conditionJson as PromoEngineDraft['conditionJson']) ||
      ({ operator: 'AND', conditions: [] } as PromoEngineDraft['conditionJson']),
    benefitJson: (p.benefitJson as PromoEngineDraft['benefitJson']) || [],
    ruleType: (p.ruleType as PromoEngineDraft['ruleType']) || 'GENERIC',
    vcf: (p.vcf as PromoEngineDraft['vcf']) || createEmptyDraft(String(p.id)).vcf,
    customerCopy: readCustomerCopy(p),
    limits: mapLimits(p.limits),
    createdAt: String(p.created_at || p.createdAt || new Date().toISOString()),
    updatedAt: String(p.updated_at || p.updatedAt || new Date().toISOString()),
  };
}

function readCustomerCopy(p: Record<string, unknown>): PromoCustomerCopy | undefined {
  const meta = p.metadata as Record<string, unknown> | undefined;
  const raw = (meta?.customerCopy ?? p.customerCopy) as unknown;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return cleanCustomerCopy(raw as PromoCustomerCopy);
}

function mapLimits(raw: unknown): PromoEngineDraft['limits'] | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const l = raw as Record<string, unknown>;
  return {
    perUser: l.per_user != null ? Number(l.per_user) : l.perUser != null ? Number(l.perUser) : null,
    perTransaction:
      l.per_transaction != null
        ? Number(l.per_transaction)
        : l.perTransaction != null
          ? Number(l.perTransaction)
          : null,
    dailyLimit:
      l.daily_limit != null ? Number(l.daily_limit) : l.dailyLimit != null ? Number(l.dailyLimit) : null,
    campaignLimit:
      l.campaign_limit != null
        ? Number(l.campaign_limit)
        : l.campaignLimit != null
          ? Number(l.campaignLimit)
          : null,
    budgetLimit:
      l.budget_limit != null
        ? Number(l.budget_limit)
        : l.budgetLimit != null
          ? Number(l.budgetLimit)
          : null,
  };
}
