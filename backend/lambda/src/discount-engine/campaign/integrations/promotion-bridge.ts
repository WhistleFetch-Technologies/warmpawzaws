import { insert } from '../../../database/rds-connection';
import { buildPromotionPersistenceFromAdminBody } from '../../../utils/promotion-admin-persistence';
import { enrichPromotionMetadataWithCampaign } from '../campaign-audit';
import type { CommercialCampaignRecord } from '../types';

export interface PromotionBridgeResult {
  promotionId: string;
  record: Record<string, unknown>;
}

export interface CouponBridgeResult {
  couponId: string;
  record: Record<string, unknown>;
}

/**
 * Creates promotions via existing persistence path — no duplicate promotion engine.
 */
export async function createPromotionForCampaign(
  campaign: CommercialCampaignRecord,
  body: Record<string, unknown>,
  schedule?: { promotionStartDate?: string; promotionEndDate?: string }
): Promise<PromotionBridgeResult> {
  const metadata = enrichPromotionMetadataWithCampaign(
    body.metadata as Record<string, unknown> | undefined,
    campaign
  );

  const mergedBody: Record<string, unknown> = {
    ...body,
    name: body.name ?? `${campaign.name} Promotion`,
    valid_from: body.valid_from ?? schedule?.promotionStartDate,
    valid_until: body.valid_until ?? schedule?.promotionEndDate,
    metadata,
    funding_type: campaign.funding.type,
    funding_split: campaign.funding.split ?? undefined,
    vendor_id: campaign.vendorId ?? body.vendor_id,
    discount_domain: campaign.discountDomain,
    domain: campaign.discountDomain,
    surface: campaign.surface,
  };

  const record = buildPromotionPersistenceFromAdminBody(mergedBody) as Record<string, unknown>;
  record.metadata = metadata;
  record.discount_domain = campaign.discountDomain;

  const rows = await insert('promotions', record);
  const created = rows[0] as Record<string, unknown>;
  return { promotionId: String(created.id), record: created };
}

/**
 * Creates coupons via existing coupons table insert — mirrors POST /admin/coupons.
 */
export async function createCouponForCampaign(
  campaign: CommercialCampaignRecord,
  body: Record<string, unknown>
): Promise<CouponBridgeResult> {
  const code = String(body.code ?? '').toUpperCase();
  if (!code) throw new Error('Coupon code is required');

  const couponData: Record<string, unknown> = {
    code,
    name: String(body.name ?? code),
    discount_type: body.discount_type ?? body.type ?? 'percentage',
    discount_value: Number(body.discount_value ?? body.value ?? 0),
    start_date: body.start_date ?? body.valid_from ?? new Date(),
    end_date:
      body.end_date ??
      body.valid_until ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    is_active: body.is_active ?? true,
    discount_domain: campaign.discountDomain,
    applicable_to: campaign.discountDomain === 'ECOMMERCE' ? 'products' : body.applicable_to ?? 'bookings',
    metadata: {
      ...(typeof body.metadata === 'object' && body.metadata ? (body.metadata as object) : {}),
      commercialCampaignId: campaign.id,
      discount_domain: campaign.discountDomain,
      domain: campaign.discountDomain === 'ECOMMERCE' ? 'ecommerce' : 'service',
      surface: campaign.surface,
      funding: campaign.funding,
    },
  };

  try {
    const rows = await insert('coupons', couponData);
    const created = rows[0] as Record<string, unknown>;
    return { couponId: String(created.id), record: created };
  } catch (err: unknown) {
    const msg = String((err as Error)?.message ?? err);
    if (msg.includes('discount_domain') || msg.includes('column')) {
      const fallback = { ...couponData };
      delete fallback.discount_domain;
      delete fallback.applicable_to;
      delete fallback.metadata;
      const rows = await insert('coupons', fallback);
      const created = rows[0] as Record<string, unknown>;
      return { couponId: String(created.id), record: created };
    }
    throw err;
  }
}

/** Test doubles — no DB. */
export async function mockCreatePromotionForCampaign(
  campaign: CommercialCampaignRecord,
  body: Record<string, unknown>
): Promise<PromotionBridgeResult> {
  return {
    promotionId: `promo-mock-${campaign.id}`,
    record: { ...body, campaignId: campaign.id },
  };
}

export async function mockCreateCouponForCampaign(
  campaign: CommercialCampaignRecord,
  body: Record<string, unknown>
): Promise<CouponBridgeResult> {
  return {
    couponId: `coupon-mock-${campaign.id}`,
    record: { ...body, campaignId: campaign.id },
  };
}
