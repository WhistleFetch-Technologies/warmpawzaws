/**
 * Shared promotion targeting persistence for /admin/promotions (canonical) and
 * backward-compatible field mapping from wizard + legacy marketing payloads.
 */

import { isValidUUID } from '../types/entities';
import { resolvePersistedDiscountDomain } from './commercial-discount-domain';
import { promotionEndDateToIso, promotionStartDateToIso } from './promotion-date-bounds';

export function normalizePromotionDiscountType(raw: unknown): 'percentage' | 'fixed' {
  const value = String(raw || 'percentage').trim().toLowerCase();
  if (value === 'flat') return 'fixed';
  if (value === 'fixed') return 'fixed';
  return 'percentage';
}

export function normalizeStyleToken(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'all') return '';
  if (value === 'home' || value === 'at_home' || value === 'home_visit') return 'at_home';
  if (value === 'clinic' || value === 'center' || value === 'at_center') return 'at_center';
  if (value === 'online' || value === 'tele') return 'tele';
  return value;
}

export function parseServicesList(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x).trim()).filter(Boolean);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((x) => String(x).trim()).filter(Boolean) : [];
    } catch {
      return [raw.trim()].filter(Boolean);
    }
  }
  return [];
}

export function parseDateInput(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const value = String(raw).trim();
  if (!value) return null;
  const normalized = value.includes('T') ? value : `${value}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
}

function mapPromotionType(raw: unknown): string {
  const value = String(raw || 'flash_sale').trim().toLowerCase();
  if (value === 'percentage' || value === 'flat') return 'flash_sale';
  return value || 'flash_sale';
}

/** Build applicable_services JSON tokens from admin/wizard body. */
export function buildApplicableServicesFromBody(body: Record<string, unknown>): string[] {
  const explicit = parseServicesList(body.applicable_services ?? body.applicableServices);
  if (explicit.length > 0) return Array.from(new Set(explicit));

  const selectedTargets =
    body.selected_targets && typeof body.selected_targets === 'object'
      ? (body.selected_targets as Record<string, string[]>)
      : {};
  const targetScopes = parseServicesList(body.target_scopes) as string[];

  if (targetScopes.includes('entire_platform')) return [];

  const tokens: string[] = [];

  for (const cat of [
    ...parseServicesList(body.applicable_category_ids),
    ...parseServicesList(body.applicable_categories),
    ...(selectedTargets.categories ?? []),
  ]) {
    const id = String(cat).trim().toLowerCase();
    if (id && id !== 'all') tokens.push(id);
  }

  for (const style of selectedTargets.styles ?? []) {
    const normalized = normalizeStyleToken(style);
    if (normalized) tokens.push(`style:${normalized}`);
  }

  for (const id of [
    ...parseServicesList(body.applicable_service_ids),
    ...(selectedTargets.services ?? []),
    ...(selectedTargets.packages ?? []),
    ...(selectedTargets.meal_plans ?? []),
    ...(selectedTargets.products ?? []),
    ...parseServicesList(body.applicable_products),
  ]) {
    if (id) tokens.push(String(id));
  }

  const legacyCategory = String(body.serviceCategory ?? body.service_category ?? '').trim().toLowerCase();
  const legacyStyle = normalizeStyleToken(body.serviceStyle ?? body.service_style ?? '');
  if (legacyCategory && legacyCategory !== 'all') tokens.push(legacyCategory);
  if (legacyStyle) tokens.push(`style:${legacyStyle}`);

  return Array.from(new Set(tokens));
}

export function buildPromotionPersistenceFromAdminBody(
  body: Record<string, unknown>,
  existingMetadata?: Record<string, unknown>
): Record<string, unknown> {
  const name = String(body.name ?? body.title ?? '').trim();
  const description = String(body.description ?? body.subtitle ?? '').trim();
  const discountType = normalizePromotionDiscountType(
    body.discount_type ?? body.discountType ?? body.type
  );
  const discountValue = Number(
    body.discount_value ?? body.discountValue ?? body.value ?? 0
  );
  const promotionType = mapPromotionType(
    body.promotion_type ?? body.promotionType ?? body.type
  );

  const startDateInput =
    body.valid_from ?? body.validFrom ?? body.startDate ?? body.start_date;
  const endDateInput =
    body.valid_until ?? body.validUntil ?? body.endDate ?? body.end_date;

  const startDate = startDateInput
    ? promotionStartDateToIso(String(startDateInput).split('T')[0])
    : promotionStartDateToIso(new Date().toISOString().split('T')[0]);
  const endDate = endDateInput
    ? promotionEndDateToIso(String(endDateInput).split('T')[0])
    : null;

  const applicableServices = buildApplicableServicesFromBody(body);
  const selectedTargets =
    body.selected_targets && typeof body.selected_targets === 'object'
      ? body.selected_targets
      : {};
  const targetScopes = parseServicesList(body.target_scopes);

  const styleTokens = applicableServices
    .filter((x) => x.startsWith('style:'))
    .map((x) => normalizeStyleToken(x.replace(/^style:/, '')));
  const categoryTokens = applicableServices.filter(
    (x) => !x.startsWith('style:') && !isValidUUID(String(x))
  );
  const serviceCategory =
    String(body.service_category ?? body.serviceCategory ?? categoryTokens[0] ?? '').trim() ||
    null;
  const serviceStyle =
    normalizeStyleToken(body.service_style ?? body.serviceStyle ?? styleTokens[0] ?? '') || null;

  const incomingMetadata =
    body.metadata && typeof body.metadata === 'object'
      ? (body.metadata as Record<string, unknown>)
      : {};
  const baseMetadata = existingMetadata ?? {};

  const isActive =
    body.is_active !== undefined
      ? body.is_active !== false
      : body.active !== undefined
        ? body.active !== false
        : body.isActive !== false;

  const published =
    body.published === undefined ? isActive : body.published === true;

  const applicableProducts = parseServicesList(
    body.applicable_products ?? (selectedTargets as any).products
  );

  const discountDomain = resolvePersistedDiscountDomain(body, 'SERVICE');
  // Ecommerce must never persist bare shared "all" — that collapses into Services lists.
  let applicableTo = String(
    body.applicable_to ?? (applicableServices.length === 0 ? 'all' : 'bookings')
  )
    .trim()
    .toLowerCase();
  if (discountDomain === 'ECOMMERCE') {
    if (!applicableTo || applicableTo === 'all' || applicableTo === 'bookings' || applicableTo === 'services') {
      applicableTo = 'products';
    }
  }

  const usageLimit =
    body.usage_limit != null
      ? Number(body.usage_limit)
      : body.usageLimit != null
        ? Number(body.usageLimit)
        : null;
  const usageLimitPerUser =
    body.usage_limit_per_user != null
      ? Number(body.usage_limit_per_user)
      : body.usageLimitPerUser != null
        ? Number(body.usageLimitPerUser)
        : null;

  return {
    name,
    description,
    promotion_type: promotionType,
    discount_type: discountType,
    discount_value: discountValue,
    min_order_amount:
      body.min_order_value != null
        ? Number(body.min_order_value)
        : body.min_order_amount != null
          ? Number(body.min_order_amount)
          : body.minOrderAmount != null
            ? Number(body.minOrderAmount)
            : null,
    max_discount_amount:
      body.max_discount != null
        ? Number(body.max_discount)
        : body.max_discount_amount != null
          ? Number(body.max_discount_amount)
          : body.maxDiscountAmount != null
            ? Number(body.maxDiscountAmount)
            : null,
    start_date: startDate,
    end_date: endDate,
    is_active: isActive,
    published,
    applicable_services:
      applicableServices.length > 0 ? JSON.stringify(applicableServices) : null,
    service_category: serviceCategory && serviceCategory !== 'all' ? serviceCategory : null,
    service_style: serviceStyle && serviceStyle !== 'all' ? serviceStyle : null,
    applicable_to: applicableTo,
    discount_domain: discountDomain,
    max_uses: usageLimit,
    max_uses_per_user: usageLimitPerUser,
    usage_limit: usageLimit,
    priority: body.priority != null ? parseInt(String(body.priority), 10) || 0 : 0,
    is_spotlight: body.is_spotlight === true || body.targetAudience === 'vip',
    metadata: {
      ...baseMetadata,
      ...incomingMetadata,
      applicableProducts,
      targetScopes,
      selectedTargets,
      discount_domain: discountDomain,
      domain: discountDomain === 'ECOMMERCE' ? 'ecommerce' : 'service',
      surface: discountDomain === 'ECOMMERCE' ? 'ecommerce' : 'marketing',
      promotionTarget: {
        ...(((baseMetadata as any)?.promotionTarget || {}) as Record<string, unknown>),
        ...(((incomingMetadata as any)?.promotionTarget || {}) as Record<string, unknown>),
        targetScopes,
        selectedTargets,
        serviceCategory: serviceCategory || 'all',
        serviceStyle: serviceStyle || 'all',
        discountDomain,
      },
      serviceCategory: serviceCategory || 'all',
      serviceStyle: serviceStyle || 'all',
    },
    updated_at: new Date().toISOString(),
  };
}

export function isEcommerceAdminPromotionDomain(body: Record<string, unknown>): boolean {
  return resolvePersistedDiscountDomain(body, 'SERVICE') === 'ECOMMERCE';
}

/** Map admin wizard body → `ecommerce_admin_promotions` row (canonical shop promos). */
export function buildEcommerceAdminPromotionRecord(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const base = buildPromotionPersistenceFromAdminBody(body);
  const meta =
    base.metadata && typeof base.metadata === 'object'
      ? (base.metadata as Record<string, unknown>)
      : {};
  const selectedTargets =
    meta.selectedTargets && typeof meta.selectedTargets === 'object'
      ? (meta.selectedTargets as Record<string, unknown>)
      : {};

  const applicableProducts = parseServicesList(
    body.applicable_products ?? meta.applicableProducts ?? selectedTargets.products,
  );
  const applicableCategories = parseServicesList(
    body.applicable_category_ids ??
      body.applicable_categories ??
      selectedTargets.categories,
  );

  const codeRaw = body.code != null ? String(body.code).trim() : '';
  const targetAudience = String(
    body.target_audience ?? body.targetAudience ?? 'all',
  ).trim();

  return {
    name: base.name,
    description: base.description ?? null,
    code: codeRaw ? codeRaw.toUpperCase() : null,
    promotion_type: base.promotion_type,
    discount_type: base.discount_type,
    discount_value: base.discount_value,
    min_order_value: base.min_order_amount ?? null,
    max_discount_amount: base.max_discount_amount ?? null,
    start_date: base.start_date,
    end_date: base.end_date,
    is_active: base.is_active,
    published: base.published,
    usage_limit: base.usage_limit ?? null,
    usage_count: 0,
    target_audience: targetAudience || 'all',
    applicable_products:
      applicableProducts.length > 0 ? JSON.stringify(applicableProducts) : null,
    applicable_categories:
      applicableCategories.length > 0 ? JSON.stringify(applicableCategories) : null,
    funded_by: 'admin',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

export function mergeAdminPromotionUpdateBody(
  body: Record<string, unknown>,
  existing: Record<string, unknown>
): Record<string, unknown> {
  const existingMeta =
    existing.metadata && typeof existing.metadata === 'object'
      ? (existing.metadata as Record<string, unknown>)
      : {};

  const mergedInput: Record<string, unknown> = {
    name: body.name ?? existing.name,
    title: body.title ?? existing.name,
    description: body.description ?? existing.description,
    discount_type: body.discount_type ?? body.discountType ?? existing.discount_type,
    discount_value: body.discount_value ?? body.discountValue ?? existing.discount_value,
    valid_from: body.valid_from ?? body.validFrom ?? body.startDate ?? existing.start_date,
    valid_until: body.valid_until ?? body.validUntil ?? body.endDate ?? existing.end_date,
    min_order_value: body.min_order_value ?? body.minOrderAmount ?? existing.min_order_amount,
    max_discount: body.max_discount ?? body.maxDiscountAmount ?? existing.max_discount_amount,
    usage_limit: body.usage_limit ?? body.usageLimit ?? existing.max_uses,
    usage_limit_per_user:
      body.usage_limit_per_user ?? body.usageLimitPerUser ?? existing.max_uses_per_user,
    is_active: body.is_active ?? body.isActive ?? body.active ?? existing.is_active,
    published:
      body.published !== undefined
        ? body.published === true
        : body.is_active === true || body.active === true || body.isActive === true
          ? true
          : existing.published,
    applicable_services: body.applicable_services ?? body.applicableServices ?? existing.applicable_services,
    service_category: body.service_category ?? body.serviceCategory ?? existing.service_category,
    service_style: body.service_style ?? body.serviceStyle ?? existing.service_style,
    target_scopes: body.target_scopes,
    selected_targets: body.selected_targets,
    applicable_category_ids: body.applicable_category_ids,
    applicable_service_ids: body.applicable_service_ids,
    applicable_products: body.applicable_products,
    promotion_type: body.promotion_type ?? body.promotionType ?? body.type ?? existing.promotion_type,
    is_spotlight: body.is_spotlight ?? existing.is_spotlight,
    metadata: body.metadata ?? existingMeta,
    priority: body.priority ?? existing.priority,
    applicable_to: body.applicable_to ?? existing.applicable_to,
    discount_domain:
      body.discount_domain ??
      body.discountDomain ??
      body.domain ??
      existing.discount_domain ??
      existing.discountDomain,
  };

  if (body.code !== undefined) mergedInput.code = body.code;

  return buildPromotionPersistenceFromAdminBody(mergedInput, existingMeta);
}
