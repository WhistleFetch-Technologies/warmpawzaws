import type {
  CampaignDiscountDomain,
  CampaignSurface,
  CommercialCampaignRecord,
} from './types';

export function parseCampaignDiscountDomain(raw: unknown): CampaignDiscountDomain | null {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim().toUpperCase();
  if (value === 'SERVICE' || value === 'SERVICES' || value === 'BOOKING') return 'SERVICE';
  if (
    value === 'ECOMMERCE' ||
    value === 'PRODUCT' ||
    value === 'PRODUCTS' ||
    value === 'SHOP' ||
    value === 'MARKETPLACE'
  ) {
    return 'ECOMMERCE';
  }
  return null;
}

export function parseCampaignSurface(raw: unknown): CampaignSurface | null {
  if (raw == null || raw === '') return null;
  const value = String(raw).trim().toLowerCase();
  if (value === 'ecommerce' || value === 'shop' || value === 'marketplace') return 'ecommerce';
  if (value === 'marketing' || value === 'service' || value === 'services') return 'marketing';
  return null;
}

/** Resolve durable domain from column, metadata, or surface (legacy fallback → SERVICE). */
export function resolveCampaignDiscountDomain(input: {
  discountDomain?: unknown;
  surface?: unknown;
  metadata?: Record<string, unknown>;
  fallback?: CampaignDiscountDomain;
}): CampaignDiscountDomain {
  const fromField = parseCampaignDiscountDomain(input.discountDomain);
  if (fromField) return fromField;
  const meta = input.metadata ?? {};
  const fromMeta = parseCampaignDiscountDomain(
    meta.discount_domain ?? meta.discountDomain ?? meta.domain
  );
  if (fromMeta) return fromMeta;
  const surface =
    parseCampaignSurface(input.surface) ?? parseCampaignSurface(meta.surface);
  if (surface === 'ecommerce') return 'ECOMMERCE';
  if (surface === 'marketing') return 'SERVICE';
  return input.fallback ?? 'SERVICE';
}

export function resolveCampaignSurface(input: {
  surface?: unknown;
  discountDomain?: CampaignDiscountDomain;
  metadata?: Record<string, unknown>;
}): CampaignSurface {
  const fromField = parseCampaignSurface(input.surface);
  if (fromField) return fromField;
  const meta = input.metadata ?? {};
  const fromMeta = parseCampaignSurface(meta.surface);
  if (fromMeta) return fromMeta;
  return input.discountDomain === 'ECOMMERCE' ? 'ecommerce' : 'marketing';
}

export function enrichAiReadyCampaignMetadata(
  campaign: {
    discountDomain: CommercialCampaignRecord['discountDomain'];
    surface: CommercialCampaignRecord['surface'];
    funding: CommercialCampaignRecord['funding'];
    audience: CommercialCampaignRecord['audience'];
    budgetCap?: number | null;
    budgetSpent?: number;
    goal?: string | null;
    objective?: string | null;
    policyFingerprint?: string | null;
    metadata?: Record<string, unknown>;
    vendorId?: string | null;
    status?: CommercialCampaignRecord['status'];
    startAt?: string | null;
    endAt?: string | null;
    name?: string;
    healthStatus?: string;
    timeline?: unknown;
  },
  extras?: Record<string, unknown>
): Record<string, unknown> {
  const budgetCap = campaign.budgetCap ?? null;
  const budgetSpent = Number(campaign.budgetSpent ?? 0);
  const budgetRemaining =
    budgetCap != null && Number.isFinite(budgetCap) ? Math.max(0, Number(budgetCap) - budgetSpent) : null;
  const meta = campaign.metadata ?? {};

  return {
    ...meta,
    ...(extras ?? {}),
    discount_domain: campaign.discountDomain,
    domain: campaign.discountDomain === 'ECOMMERCE' ? 'ecommerce' : 'service',
    surface: campaign.surface,
    goal: campaign.goal ?? meta.goal ?? null,
    objective: campaign.objective ?? meta.objective ?? null,
    /** AI readiness — explanation metadata only (no AI runtime). */
    businessObjective: meta.businessObjective ?? campaign.objective ?? campaign.goal ?? null,
    expectedOutcome: meta.expectedOutcome ?? null,
    owner: meta.owner ?? campaign.vendorId ?? 'platform',
    notes: meta.notes ?? null,
    successCriteria: meta.successCriteria ?? null,
    campaignHealth: campaign.healthStatus ?? meta.campaignHealth ?? null,
    timeline: campaign.timeline ?? meta.timeline ?? null,
    funding: campaign.funding,
    budget: {
      cap: budgetCap,
      spent: budgetSpent,
      remaining: budgetRemaining,
    },
    audience: campaign.audience,
    policyFingerprint: campaign.policyFingerprint ?? null,
    status: campaign.status ?? meta.status ?? null,
    schedule: { startAt: campaign.startAt ?? null, endAt: campaign.endAt ?? null },
    name: campaign.name ?? meta.name ?? null,
    aiReady: true,
  };
}

export function isBudgetExhausted(campaign: Pick<CommercialCampaignRecord, 'budgetCap' | 'budgetSpent'>): boolean {
  if (campaign.budgetCap == null || !Number.isFinite(Number(campaign.budgetCap))) return false;
  return Number(campaign.budgetSpent ?? 0) >= Number(campaign.budgetCap);
}
