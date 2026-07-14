/**
 * Seller ecommerce offers via Discount Engine V2 Commercial Campaign Engine.
 *
 * Ownership / orchestration: commercial_discount_campaigns (funding=VENDOR, domain=ECOMMERCE)
 * Apply path (cart / order): still materializes into vendor_promotions (linked by promotion_id)
 * so calculate-cart and ecommerce order validation keep working.
 */

import { insert, query, update, deleteRows } from '../database/rds-connection';
import { DiscountFunding } from '../discount-engine/enums/discount-funding';
import { getCampaignEngine } from '../discount-engine/campaign/campaign-engine';
import { isCampaignEnabled } from '../discount-engine/campaign/campaign-mode';
import { getCampaignRepository } from '../discount-engine/campaign/repositories/campaign-repository';
import type {
  CampaignLifecycleStatus,
  CommercialCampaignRecord,
} from '../discount-engine/campaign/types';
import {
  promotionEndDateToIso,
  promotionStartDateToIso,
} from './promotion-date-bounds';

export type VendorSellerOfferBody = {
  name: string;
  description?: string;
  code?: string | null;
  promotion_type?: string;
  discount_type?: string;
  discount_value: number | string;
  min_order_value?: number | string | null;
  max_discount_amount?: number | string | null;
  start_date: string;
  end_date: string;
  is_active?: boolean;
  usage_limit?: number | null;
  target_audience?: string;
  applicable_products?: string[] | null;
  applicable_categories?: string[] | null;
  buy_quantity?: number | null;
  get_quantity?: number | null;
  get_discount_percent?: number | null;
  bundle_products?: string[] | null;
  bundle_discount?: number | null;
};

function normalizeDbRow(row: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!row) return null;
  return row;
}

function mapCampaignStatus(body: VendorSellerOfferBody): CampaignLifecycleStatus {
  const active = body.is_active !== false;
  if (!active) return 'paused';
  const start = new Date(promotionStartDateToIso(body.start_date)).getTime();
  const end = new Date(promotionEndDateToIso(body.end_date)).getTime();
  const now = Date.now();
  if (Number.isFinite(end) && end < now) return 'expired';
  if (Number.isFinite(start) && start > now) return 'scheduled';
  return 'running';
}

function mapCampaignType(promotionType: string | undefined): string {
  const t = String(promotionType || 'flash_sale').toLowerCase();
  if (t.includes('coupon') || t === 'code') return 'flash_sale';
  if (t === 'first_order' || t === 'seasonal' || t === 'referral') return t;
  return 'vendor_sponsored';
}

async function findCampaignIdForVendorPromo(promotionId: string): Promise<string | null> {
  try {
    const res = await query(
      `SELECT campaign_id::text AS campaign_id
       FROM commercial_campaign_promotion_links
       WHERE promotion_id::text = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [promotionId]
    );
    const rows = Array.isArray(res) ? res : res.rows ?? [];
    return rows[0]?.campaign_id ? String(rows[0].campaign_id) : null;
  } catch {
    return null;
  }
}

function buildVendorPromotionRow(vendorId: string, body: VendorSellerOfferBody): Record<string, unknown> {
  const promotionType = String(body.promotion_type || 'flash_sale');
  const resolvedDiscountValue =
    promotionType === 'bundle' && body.bundle_discount != null
      ? parseFloat(String(body.bundle_discount))
      : parseFloat(String(body.discount_value));

  return {
    vendor_id: vendorId,
    name: body.name,
    description: body.description || '',
    code: body.code ? String(body.code).toUpperCase() : null,
    promotion_type: promotionType,
    discount_type: body.discount_type || 'percentage',
    discount_value: resolvedDiscountValue,
    min_order_value:
      body.min_order_value != null && body.min_order_value !== ''
        ? parseFloat(String(body.min_order_value))
        : null,
    max_discount_amount:
      body.max_discount_amount != null && body.max_discount_amount !== ''
        ? parseFloat(String(body.max_discount_amount))
        : null,
    start_date: promotionStartDateToIso(body.start_date),
    end_date: promotionEndDateToIso(body.end_date),
    is_active: body.is_active !== false,
    usage_limit: body.usage_limit || null,
    usage_count: 0,
    target_audience: body.target_audience || 'all',
    applicable_products: body.applicable_products?.length ? body.applicable_products : null,
    applicable_categories: body.applicable_categories?.length
      ? body.applicable_categories
      : null,
    buy_quantity: body.buy_quantity || null,
    get_quantity: body.get_quantity || null,
    get_discount_percent: body.get_discount_percent || null,
    bundle_products: body.bundle_products?.length ? body.bundle_products : null,
    bundle_discount: body.bundle_discount || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Create seller offer in V2 campaign engine + materialize vendor_promotions for apply path.
 * Falls back to vendor_promotions-only when campaign mode is OFF.
 */
export async function createVendorEcommerceOfferV2(
  vendorId: string,
  body: VendorSellerOfferBody
): Promise<{ promotion: Record<string, unknown>; campaignId: string | null; engine: 'v2' | 'legacy' }> {
  if (body.code) {
    const existingCode = await query(
      'SELECT id FROM vendor_promotions WHERE code = $1 AND vendor_id = $2::uuid',
      [String(body.code).toUpperCase(), vendorId]
    );
    const codeRows = Array.isArray(existingCode) ? existingCode : existingCode.rows || [];
    if (codeRows.length > 0) {
      throw new Error('Promotion code already exists');
    }
  }

  const promoRows = await insert('vendor_promotions', buildVendorPromotionRow(vendorId, body));
  const promotion = normalizeDbRow(promoRows[0] as Record<string, unknown>)!;
  const promotionId = String(promotion.id);

  if (!isCampaignEnabled()) {
    console.warn(
      '[vendor-ecommerce-offer-v2] DISCOUNT_ENGINE_V2_CAMPAIGN_MODE is OFF — offer stored in vendor_promotions only'
    );
    return { promotion, campaignId: null, engine: 'legacy' };
  }

  try {
    const engine = getCampaignEngine();
    const repo = getCampaignRepository();
    const campaign = await engine.createCampaign({
      name: body.name,
      campaignType: mapCampaignType(body.promotion_type),
      funding: { type: DiscountFunding.VENDOR },
      scheduleType: 'scheduled',
      startAt: promotionStartDateToIso(body.start_date),
      endAt: promotionEndDateToIso(body.end_date),
      audience: { kind: 'all_customers', vendorId },
      notificationMode: 'skip',
      vendorId,
      discountDomain: 'ECOMMERCE',
      surface: 'ecommerce',
      metadata: {
        source: 'vendor_seller_hub',
        vendorPromotionId: promotionId,
        offerKind: body.code ? 'coupon' : 'promotion',
        promotionType: body.promotion_type || 'flash_sale',
      },
    });

    // Link stores vendor_promotions.id in promotion_id (no FK to platform promotions).
    await repo.addLink({
      campaignId: campaign.id,
      promotionId,
      linkType: 'promotion',
    });

    // Bypass multi-step publish lifecycle — seller offers go live with the materialised row.
    await repo.update(campaign.id, {
      status: mapCampaignStatus(body),
      metadata: {
        ...campaign.metadata,
        source: 'vendor_seller_hub',
        vendorPromotionId: promotionId,
        offerKind: body.code ? 'coupon' : 'promotion',
      },
    });

    return { promotion: { ...promotion, commercial_campaign_id: campaign.id }, campaignId: campaign.id, engine: 'v2' };
  } catch (err) {
    console.warn(
      '[vendor-ecommerce-offer-v2] campaign create failed; vendor_promotions row kept',
      err instanceof Error ? err.message : err
    );
    return { promotion, campaignId: null, engine: 'legacy' };
  }
}

export async function updateVendorEcommerceOfferV2(
  vendorId: string,
  promoId: string,
  body: Record<string, unknown>
): Promise<{ promotion: Record<string, unknown>; campaignId: string | null }> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  const fields = [
    'name',
    'description',
    'promotion_type',
    'discount_type',
    'is_active',
    'target_audience',
    'buy_quantity',
    'get_quantity',
    'get_discount_percent',
    'bundle_discount',
  ];
  for (const field of fields) {
    if (body[field] !== undefined) updateData[field] = body[field];
  }
  if (body.discount_value !== undefined) updateData.discount_value = parseFloat(String(body.discount_value));
  if (body.min_order_value !== undefined) {
    updateData.min_order_value = body.min_order_value ? parseFloat(String(body.min_order_value)) : null;
  }
  if (body.max_discount_amount !== undefined) {
    updateData.max_discount_amount = body.max_discount_amount
      ? parseFloat(String(body.max_discount_amount))
      : null;
  }
  if (body.usage_limit !== undefined) updateData.usage_limit = body.usage_limit || null;
  if (body.start_date !== undefined) updateData.start_date = promotionStartDateToIso(String(body.start_date));
  if (body.end_date !== undefined) updateData.end_date = promotionEndDateToIso(String(body.end_date));
  if (body.code !== undefined) updateData.code = body.code ? String(body.code).toUpperCase() : null;
  if (body.applicable_products !== undefined) {
    const arr = body.applicable_products as string[] | null;
    updateData.applicable_products = arr?.length ? arr : null;
  }
  if (body.applicable_categories !== undefined) {
    const arr = body.applicable_categories as string[] | null;
    updateData.applicable_categories = arr?.length ? arr : null;
  }
  if (body.bundle_products !== undefined) {
    const arr = body.bundle_products as string[] | null;
    updateData.bundle_products = arr?.length ? arr : null;
  }

  await update('vendor_promotions', { id: promoId, vendor_id: vendorId }, updateData);

  const updated = await query(
    'SELECT * FROM vendor_promotions WHERE id = $1::uuid AND vendor_id = $2::uuid',
    [promoId, vendorId]
  );
  const rows = Array.isArray(updated) ? updated : updated.rows || [];
  const promotion = normalizeDbRow(rows[0] as Record<string, unknown>);
  if (!promotion) throw new Error('Promotion not found');

  let campaignId = await findCampaignIdForVendorPromo(promoId);

  if (isCampaignEnabled() && campaignId) {
    try {
      const repo = getCampaignRepository();
      const patch: Partial<CommercialCampaignRecord> = {};
      if (body.name !== undefined) patch.name = String(body.name);
      if (body.start_date !== undefined) patch.startAt = promotionStartDateToIso(String(body.start_date));
      if (body.end_date !== undefined) patch.endAt = promotionEndDateToIso(String(body.end_date));
      if (
        body.is_active !== undefined ||
        body.start_date !== undefined ||
        body.end_date !== undefined
      ) {
        patch.status = mapCampaignStatus({
          name: String(promotion.name),
          discount_value: Number(promotion.discount_value),
          start_date: String(promotion.start_date),
          end_date: String(promotion.end_date),
          is_active: promotion.is_active !== false,
          code: promotion.code != null ? String(promotion.code) : null,
        });
      }
      if (Object.keys(patch).length) {
        await repo.update(campaignId, patch);
      }
    } catch (err) {
      console.warn(
        '[vendor-ecommerce-offer-v2] campaign sync on update failed',
        err instanceof Error ? err.message : err
      );
    }
  } else if (isCampaignEnabled() && !campaignId) {
    // Legacy row: attach a V2 campaign on first edit after migration (no duplicate materialization).
    campaignId = await attachV2CampaignToExistingVendorPromo(vendorId, promoId, promotion);
  }

  return {
    promotion: campaignId ? { ...promotion, commercial_campaign_id: campaignId } : promotion,
    campaignId,
  };
}

async function attachV2CampaignToExistingVendorPromo(
  vendorId: string,
  promoId: string,
  promotion: Record<string, unknown>
): Promise<string | null> {
  if (!isCampaignEnabled()) return null;
  try {
    const engine = getCampaignEngine();
    const repo = getCampaignRepository();
    const campaign = await engine.createCampaign({
      name: String(promotion.name),
      campaignType: mapCampaignType(String(promotion.promotion_type)),
      funding: { type: DiscountFunding.VENDOR },
      scheduleType: 'scheduled',
      startAt: new Date(String(promotion.start_date)).toISOString(),
      endAt: new Date(String(promotion.end_date)).toISOString(),
      audience: { kind: 'all_customers', vendorId },
      notificationMode: 'skip',
      vendorId,
      discountDomain: 'ECOMMERCE',
      surface: 'ecommerce',
      metadata: {
        source: 'vendor_seller_hub_backfill',
        vendorPromotionId: promoId,
        offerKind: promotion.code ? 'coupon' : 'promotion',
      },
    });
    await repo.addLink({
      campaignId: campaign.id,
      promotionId: promoId,
      linkType: 'promotion',
    });
    await repo.update(campaign.id, {
      status: mapCampaignStatus({
        name: String(promotion.name),
        discount_value: Number(promotion.discount_value),
        start_date: String(promotion.start_date),
        end_date: String(promotion.end_date),
        is_active: promotion.is_active !== false,
        code: promotion.code != null ? String(promotion.code) : null,
      }),
    });
    return campaign.id;
  } catch (err) {
    console.warn(
      '[vendor-ecommerce-offer-v2] backfill campaign failed',
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function deleteVendorEcommerceOfferV2(
  vendorId: string,
  promoId: string
): Promise<{ campaignId: string | null }> {
  const campaignId = await findCampaignIdForVendorPromo(promoId);

  if (isCampaignEnabled() && campaignId) {
    try {
      const repo = getCampaignRepository();
      await repo.update(campaignId, { status: 'archived' });
      await repo.detachLink(campaignId, { promotionId: promoId });
    } catch (err) {
      console.warn(
        '[vendor-ecommerce-offer-v2] campaign archive failed',
        err instanceof Error ? err.message : err
      );
    }
  }

  await deleteRows('vendor_promotions', { id: promoId, vendor_id: vendorId });
  return { campaignId };
}

/** Enrich list rows with commercial_campaign_id when linked. */
export async function enrichVendorPromotionsWithCampaignIds(
  rows: Record<string, unknown>[]
): Promise<Record<string, unknown>[]> {
  if (!rows.length || !isCampaignEnabled()) return rows;
  const ids = rows.map((r) => String(r.id)).filter(Boolean);
  if (!ids.length) return rows;
  try {
    const res = await query(
      `SELECT promotion_id::text AS promotion_id, campaign_id::text AS campaign_id
       FROM commercial_campaign_promotion_links
       WHERE promotion_id::text = ANY($1::text[])`,
      [ids]
    );
    const linkRows = Array.isArray(res) ? res : res.rows ?? [];
    const map = new Map(
      linkRows.map((r: { promotion_id: string; campaign_id: string }) => [
        String(r.promotion_id),
        String(r.campaign_id),
      ])
    );
    return rows.map((r) => {
      const cid = map.get(String(r.id));
      return cid ? { ...r, commercial_campaign_id: cid } : r;
    });
  } catch {
    return rows;
  }
}
