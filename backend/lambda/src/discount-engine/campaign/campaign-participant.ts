import { query } from '../../database/rds-connection';
import type { CampaignDiscountDomain, CommercialCampaignRecord } from './types';
import { getCampaignRepository } from './repositories/campaign-repository';
import { evaluateCampaignHealth } from './campaign-health';

export type ParticipantRelation = 'owned' | 'participating';

export interface ParticipantCampaignView extends CommercialCampaignRecord {
  participantRelation: ParticipantRelation;
  ownershipLabel: 'Owned by You' | 'Participating';
  health?: ReturnType<typeof evaluateCampaignHealth>;
}

/**
 * Lists campaigns where the vendor/seller owns or participates
 * (vendor_id, audience, metadata participants, or linked offer ownership).
 */
export async function listParticipantCampaigns(opts: {
  vendorId: string;
  discountDomain?: CampaignDiscountDomain;
  surface?: string;
  includeHealth?: boolean;
}): Promise<ParticipantCampaignView[]> {
  const vendorId = opts.vendorId;
  const params: unknown[] = [vendorId];
  let domainClause = '';
  if (opts.discountDomain) {
    params.push(opts.discountDomain);
    domainClause = `AND (
      UPPER(COALESCE(c.discount_domain, '')) = $${params.length}
      OR UPPER(COALESCE(c.metadata->>'discount_domain', '')) = $${params.length}
    )`;
  }
  if (opts.surface) {
    params.push(String(opts.surface).toLowerCase());
    domainClause += ` AND (
      LOWER(COALESCE(c.surface, '')) = $${params.length}
      OR LOWER(COALESCE(c.metadata->>'surface', '')) = $${params.length}
    )`;
  }

  let rows: Record<string, unknown>[] = [];
  try {
    const result = await query(
      `SELECT DISTINCT c.*
       FROM commercial_discount_campaigns c
       LEFT JOIN commercial_campaign_promotion_links l
         ON l.campaign_id = c.id AND COALESCE(l.is_active, true) = true
       LEFT JOIN promotions p ON p.id = l.promotion_id
       LEFT JOIN coupons cp ON cp.id = l.coupon_id
       WHERE c.status <> 'archived'
         AND (
           c.vendor_id::text = $1
           OR COALESCE(c.audience->>'vendorId', '') = $1
           OR (jsonb_typeof(COALESCE(c.metadata->'participantVendorIds', '[]'::jsonb)) = 'array'
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements_text(COALESCE(c.metadata->'participantVendorIds', '[]'::jsonb)) x
                 WHERE x = $1
               ))
           OR (jsonb_typeof(COALESCE(c.metadata->'vendorIds', '[]'::jsonb)) = 'array'
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements_text(COALESCE(c.metadata->'vendorIds', '[]'::jsonb)) x
                 WHERE x = $1
               ))
           OR (jsonb_typeof(COALESCE(c.metadata->'sellerIds', '[]'::jsonb)) = 'array'
               AND EXISTS (
                 SELECT 1 FROM jsonb_array_elements_text(COALESCE(c.metadata->'sellerIds', '[]'::jsonb)) x
                 WHERE x = $1
               ))
           OR COALESCE(p.vendor_id::text, '') = $1
           OR COALESCE(p.seller_id::text, '') = $1
           OR COALESCE(cp.vendor_id::text, '') = $1
           OR COALESCE(cp.seller_id::text, '') = $1
           OR EXISTS (
             SELECT 1 FROM vendor_promotions vp
             WHERE vp.vendor_id::text = $1 AND vp.id::text = l.promotion_id::text
           )
           OR EXISTS (
             SELECT 1 FROM vendor_service_promotions vsp
             WHERE vsp.vendor_id::text = $1 AND vsp.id::text = l.promotion_id::text
           )
         )
         ${domainClause}
       ORDER BY c.created_at DESC`,
      params
    );
    rows = (Array.isArray(result) ? result : result.rows ?? []) as Record<string, unknown>[];
  } catch (err) {
    // Fallback when optional columns/tables missing
    console.warn(
      '[listParticipantCampaigns] full query failed, using ownership/audience fallback',
      err instanceof Error ? err.message : err
    );
    const fallback = await query(
      `SELECT c.*
       FROM commercial_discount_campaigns c
       WHERE c.status <> 'archived'
         AND (
           c.vendor_id::text = $1
           OR COALESCE(c.audience->>'vendorId', '') = $1
         )
         ${domainClause}
       ORDER BY c.created_at DESC`,
      params
    );
    rows = (Array.isArray(fallback) ? fallback : fallback.rows ?? []) as Record<string, unknown>[];
  }

  const repo = getCampaignRepository();
  const mapped: ParticipantCampaignView[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const id = String(row.id);
    if (seen.has(id)) continue;
    seen.add(id);
    const campaign = await repo.findById(id);
    if (!campaign) continue;
    if (opts.discountDomain && campaign.discountDomain !== opts.discountDomain) continue;

    const owned = campaign.vendorId === vendorId;
    const view: ParticipantCampaignView = {
      ...campaign,
      participantRelation: owned ? 'owned' : 'participating',
      ownershipLabel: owned ? 'Owned by You' : 'Participating',
    };

    if (opts.includeHealth) {
      const links = await repo.getLinks(campaign.id, { includeInactive: true });
      view.health = evaluateCampaignHealth(campaign, links);
    }
    mapped.push(view);
  }

  return mapped;
}

export async function assertParticipantAccess(
  campaignId: string,
  vendorId: string
): Promise<ParticipantCampaignView | null> {
  const list = await listParticipantCampaigns({ vendorId, includeHealth: true });
  return list.find((c) => c.id === campaignId) ?? null;
}

/** Vendor may mutate only when they own the campaign. */
export function canVendorMutateCampaign(campaign: CommercialCampaignRecord, vendorId: string): boolean {
  return Boolean(campaign.vendorId && campaign.vendorId === vendorId);
}
