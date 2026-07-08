import { query } from '../../database/rds-connection';
import { normalizeCampaignFunding } from './campaign-funding';
import { parseCampaignDiscountDomain } from './campaign-domain';
import { isBudgetExhausted } from './campaign-domain';
import type {
  CampaignDiscountDomain,
  CampaignPromotionLink,
  CommercialCampaignRecord,
} from './types';

export interface CampaignValidationIssue {
  code: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface CampaignPublishValidation {
  valid: boolean;
  errors: CampaignValidationIssue[];
  warnings: CampaignValidationIssue[];
}

function activeStatus(raw: unknown): boolean {
  if (raw === false || raw === 0 || raw === 'false') return false;
  const s = String(raw ?? 'active').toLowerCase();
  return !['inactive', 'paused', 'expired', 'cancelled', 'archived', 'deleted'].includes(s);
}

async function loadLinkedOfferDomains(
  links: CampaignPromotionLink[]
): Promise<{
  domains: CampaignDiscountDomain[];
  missing: string[];
  inactive: string[];
}> {
  const domains: CampaignDiscountDomain[] = [];
  const missing: string[] = [];
  const inactive: string[] = [];

  for (const link of links.filter((l) => l.isActive !== false)) {
    if (link.promotionId) {
      try {
        const result = await query(
          `SELECT id, status, is_active, discount_domain, metadata FROM promotions WHERE id = $1 LIMIT 1`,
          [link.promotionId]
        );
        const rows = Array.isArray(result) ? result : result.rows ?? [];
        if (!rows.length) {
          missing.push(`promotion:${link.promotionId}`);
          continue;
        }
        const row = rows[0] as Record<string, unknown>;
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const domain =
          parseCampaignDiscountDomain(row.discount_domain) ??
          parseCampaignDiscountDomain(meta.discount_domain ?? meta.discountDomain ?? meta.domain);
        if (domain) domains.push(domain);
        const isActive =
          row.is_active === undefined
            ? activeStatus(row.status)
            : Boolean(row.is_active) && activeStatus(row.status);
        if (!isActive) inactive.push(`promotion:${link.promotionId}`);
      } catch {
        missing.push(`promotion:${link.promotionId}`);
      }
    }
    if (link.couponId) {
      try {
        const result = await query(
          `SELECT id, status, is_active, discount_domain, metadata FROM coupons WHERE id = $1 LIMIT 1`,
          [link.couponId]
        );
        const rows = Array.isArray(result) ? result : result.rows ?? [];
        if (!rows.length) {
          missing.push(`coupon:${link.couponId}`);
          continue;
        }
        const row = rows[0] as Record<string, unknown>;
        const meta = (row.metadata ?? {}) as Record<string, unknown>;
        const domain =
          parseCampaignDiscountDomain(row.discount_domain) ??
          parseCampaignDiscountDomain(meta.discount_domain ?? meta.discountDomain ?? meta.domain);
        if (domain) domains.push(domain);
        const isActive =
          row.is_active === undefined
            ? activeStatus(row.status)
            : Boolean(row.is_active) && activeStatus(row.status);
        if (!isActive) inactive.push(`coupon:${link.couponId}`);
      } catch {
        missing.push(`coupon:${link.couponId}`);
      }
    }
  }

  return { domains, missing, inactive };
}

async function findOverlappingCampaigns(
  campaign: CommercialCampaignRecord,
  links: CampaignPromotionLink[]
): Promise<Array<{ campaignId: string; name: string; offerRef: string }>> {
  const overlaps: Array<{ campaignId: string; name: string; offerRef: string }> = [];
  const promoIds = links.map((l) => l.promotionId).filter(Boolean) as string[];
  const couponIds = links.map((l) => l.couponId).filter(Boolean) as string[];
  if (!promoIds.length && !couponIds.length) return overlaps;

  try {
    const result = await query(
      `SELECT c.id, c.name, l.promotion_id, l.coupon_id
       FROM commercial_campaign_promotion_links l
       JOIN commercial_discount_campaigns c ON c.id = l.campaign_id
       WHERE c.id <> $1
         AND COALESCE(l.is_active, true) = true
         AND c.status IN ('approved', 'scheduled', 'running', 'paused')
         AND (
           ($2::text[] <> '{}' AND l.promotion_id = ANY($2::text[]))
           OR ($3::text[] <> '{}' AND l.coupon_id = ANY($3::text[]))
         )`,
      [campaign.id, promoIds, couponIds]
    );
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    for (const row of rows as Record<string, unknown>[]) {
      overlaps.push({
        campaignId: String(row.id),
        name: String(row.name),
        offerRef: row.promotion_id
          ? `promotion:${row.promotion_id}`
          : `coupon:${row.coupon_id}`,
      });
    }
  } catch {
    // Link table naming may vary — soft-fail as warning elsewhere if needed
  }

  return overlaps;
}

/**
 * Pre-publish validation. Errors block publish; overlap warnings do not unless policy requires.
 */
export async function validateCampaignForPublish(
  campaign: CommercialCampaignRecord,
  links: CampaignPromotionLink[],
  opts?: { blockOnOverlap?: boolean }
): Promise<CampaignPublishValidation> {
  const errors: CampaignValidationIssue[] = [];
  const warnings: CampaignValidationIssue[] = [];

  const funding = normalizeCampaignFunding(campaign.funding);
  if (!funding.valid) {
    for (const message of funding.errors) {
      errors.push({ code: 'FUNDING_INVALID', severity: 'error', message });
    }
  }

  if (isBudgetExhausted(campaign)) {
    errors.push({
      code: 'BUDGET_INSUFFICIENT',
      severity: 'error',
      message: 'Campaign budget is exhausted',
    });
  }

  if (campaign.startAt && campaign.endAt) {
    const start = new Date(campaign.startAt).getTime();
    const end = new Date(campaign.endAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      errors.push({
        code: 'SCHEDULE_INVALID',
        severity: 'error',
        message: 'End date must be after start date',
      });
    }
  }

  if (campaign.scheduleType === 'scheduled' && !campaign.startAt) {
    errors.push({
      code: 'SCHEDULE_MISSING_START',
      severity: 'error',
      message: 'Scheduled campaigns require a start date',
    });
  }

  const activeLinks = links.filter((l) => l.isActive !== false);
  if (activeLinks.length === 0) {
    errors.push({
      code: 'NO_LINKED_OFFERS',
      severity: 'error',
      message: 'Campaign must link at least one promotion or coupon before publish',
    });
  }

  const { domains, missing, inactive } = await loadLinkedOfferDomains(activeLinks);
  for (const ref of missing) {
    errors.push({
      code: 'OFFER_MISSING',
      severity: 'error',
      message: `Linked offer not found: ${ref}`,
    });
  }
  for (const ref of inactive) {
    errors.push({
      code: 'OFFER_INACTIVE',
      severity: 'error',
      message: `Linked offer is inactive: ${ref}`,
    });
  }

  const uniqueDomains = [...new Set(domains)];
  if (uniqueDomains.length > 1) {
    errors.push({
      code: 'DOMAIN_MIX',
      severity: 'error',
      message: 'Campaign must not mix SERVICE and ECOMMERCE offers',
    });
  }
  if (uniqueDomains.length === 1 && uniqueDomains[0] !== campaign.discountDomain) {
    errors.push({
      code: 'DOMAIN_MISMATCH',
      severity: 'error',
      message: `Linked offers are ${uniqueDomains[0]} but campaign domain is ${campaign.discountDomain}`,
    });
  }
  for (const d of domains) {
    if (d !== campaign.discountDomain) {
      errors.push({
        code: 'LINKED_DOMAIN_DRIFT',
        severity: 'error',
        message: `A linked offer belongs to ${d}, expected ${campaign.discountDomain}`,
      });
      break;
    }
  }

  if (!campaign.policyFingerprint) {
    warnings.push({
      code: 'POLICY_FINGERPRINT_MISSING',
      severity: 'warning',
      message: 'Campaign has no policy fingerprint — confirm against active Policy Center',
    });
  }

  const overlaps = await findOverlappingCampaigns(campaign, activeLinks);
  for (const o of overlaps) {
    const issue: CampaignValidationIssue = {
      code: 'OVERLAPPING_OFFER',
      severity: opts?.blockOnOverlap ? 'error' : 'warning',
      message: `Offer ${o.offerRef} also used by campaign "${o.name}" (${o.campaignId})`,
    };
    if (opts?.blockOnOverlap) errors.push(issue);
    else warnings.push(issue);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
