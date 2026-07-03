import type {
  NormalizedCouponItem,
  NormalizedPromotionItem,
  PromotionTargetCatalog,
  PromotionWizardForm,
} from './types';
import { DEFAULT_WIZARD_FORM } from './types';
import { parseApplicableServicesToTargets, summarizeTargetsFromRow } from './targeting';

function pickDate(...vals: unknown[]): string {
  for (const v of vals) {
    if (v && typeof v === 'string') return v.split('T')[0];
  }
  return new Date().toISOString().split('T')[0];
}

function uiStatusFromPromotion(p: NormalizedPromotionItem): PromotionWizardForm['uiStatus'] {
  if (!p.isActive) return 'paused';
  const today = new Date().toISOString().split('T')[0];
  if (p.startDate > today) return 'scheduled';
  if (p.endDate < today) return 'expired';
  return 'active';
}

export function normalizePromotionRow(row: Record<string, unknown>): NormalizedPromotionItem {
  const discountType =
    (row.discount_type as 'percentage' | 'fixed') ||
    (row.discountType as 'percentage' | 'fixed') ||
    'percentage';
  return {
    id: String(row.id ?? ''),
    kind: row.code && !row.auto_apply ? 'coupon' : 'promotion',
    name: String(row.name ?? row.title ?? 'Promotion'),
    description: row.description ? String(row.description) : undefined,
    code: row.code ? String(row.code) : undefined,
    promotionType: String(row.promotion_type ?? row.type ?? 'percentage'),
    discountType,
    discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
    maxDiscount: row.max_discount != null ? Number(row.max_discount) : row.maxDiscount != null ? Number(row.maxDiscount) : undefined,
    minAmount: Number(row.min_order_value ?? row.min_booking_value ?? row.minOrderValue ?? 0) || undefined,
    usageLimit: row.usage_limit != null ? Number(row.usage_limit) : row.usageLimit != null ? Number(row.usageLimit) : undefined,
    usageCount: Number(row.used_count ?? row.usage_count ?? row.usageCount ?? 0),
    usageLimitPerUser:
      row.usage_limit_per_user != null
        ? Number(row.usage_limit_per_user)
        : undefined,
    startDate: pickDate(row.start_date, row.valid_from, row.validFrom),
    endDate: pickDate(row.end_date, row.valid_until, row.validUntil),
    isActive: Boolean(row.is_active ?? row.active ?? true),
    published: row.published != null ? Boolean(row.published) : undefined,
    audience: row.target_audience ? String(row.target_audience) : row.targetAudience ? String(row.targetAudience) : undefined,
    owner: row.vendor_id ? 'vendor' : 'platform',
    targetSummary: summarizeTargetsFromRow(row),
    raw: row,
    createdAt: row.created_at ? String(row.created_at) : row.createdAt ? String(row.createdAt) : undefined,
  };
}

export function normalizeCouponRow(row: Record<string, unknown>): NormalizedCouponItem {
  return {
    id: String(row.id ?? ''),
    code: String(row.code ?? ''),
    discountType: (row.discount_type as 'percentage' | 'fixed') || (row.type as 'percentage' | 'fixed') || 'percentage',
    discountValue: Number(row.discount_value ?? row.value ?? 0),
    maxDiscount: row.max_discount != null ? Number(row.max_discount) : row.maxDiscountAmount != null ? Number(row.maxDiscountAmount) : undefined,
    minAmount: Number(row.min_order_value ?? row.minOrderAmount ?? 0) || undefined,
    usageLimit: row.usage_limit != null ? Number(row.usage_limit) : row.usageLimit != null ? Number(row.usageLimit) : undefined,
    usageCount: Number(row.used_count ?? row.usageCount ?? 0),
    startDate: pickDate(row.valid_from, row.validFrom),
    endDate: pickDate(row.valid_until, row.validUntil),
    isActive: Boolean(row.is_active ?? row.isActive ?? true),
    raw: row,
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

export function promotionToWizardForm(
  p: NormalizedPromotionItem,
  catalog?: PromotionTargetCatalog
): PromotionWizardForm {
  const base = DEFAULT_WIZARD_FORM();
  const raw = p.raw ?? {};
  const parsed = parseApplicableServicesToTargets(raw, catalog);

  return {
    ...base,
    createKind: p.kind,
    name: p.name,
    description: p.description ?? '',
    uiStatus: uiStatusFromPromotion(p),
    promotionType: (p.promotionType as PromotionWizardForm['promotionType']) || 'percentage',
    audience: (p.audience as PromotionWizardForm['audience']) || 'all',
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscount: p.maxDiscount,
    minAmount: p.minAmount,
    usageLimit: p.usageLimit,
    usageLimitPerUser: p.usageLimitPerUser,
    code: p.code,
    startDate: p.startDate,
    endDate: p.endDate,
    autoApply: p.kind === 'promotion',
    targetScopes: parsed.targetScopes,
    selectedTargets: parsed.selectedTargets,
  };
}
