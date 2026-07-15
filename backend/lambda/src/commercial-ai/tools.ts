/**
 * Execute allowlisted Commercial read tools — wraps existing engines/APIs only.
 * No writes. No SQL exposure to the model. No AWS.
 */
import { query } from '../database/rds-connection';
import { getCampaignEngine } from '../discount-engine/campaign';
import { DiscountDomain } from '../discount-engine/enums/discount-domain';
import { loadRuntimePolicy } from '../discount-engine/policy/runtime-policy-loader';
import { getActivePolicyBundle } from '../discount-engine/policy/policy-persistence';
import type { DiscountPolicyBundle } from '../discount-engine/config/business-rules-mapper';
import { getAnalyticsEngine, isAnalyticsEnabled } from '../discount-engine/analytics';
import type { CommercialCopilotToolRequest } from './tools-core';

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pickId(args: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = args[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function sanitizePromotionRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name ?? row.title,
    status: row.status,
    isActive: row.is_active,
    discountDomain: row.discount_domain,
    promotionType: row.promotion_type ?? row.type,
    startDate: row.start_date ?? row.start_at,
    endDate: row.end_date ?? row.end_at,
    vendorId: row.vendor_id,
    fundingType: row.funding_type,
  };
}

function sanitizeCouponRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    isActive: row.is_active,
    discountDomain: row.discount_domain,
    usageLimit: row.usage_limit,
    usageCount: row.usage_count,
    vendorId: row.vendor_id,
  };
}

async function getPromotionSnapshot(promotionId: string) {
  if (!uuidRe.test(promotionId)) return { error: 'invalid_promotion_id' };
  const res = await query(`SELECT * FROM promotions WHERE id = $1 LIMIT 1`, [promotionId]).catch(() => ({
    rows: [],
  }));
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return { found: false, promotionId };
  return { found: true, promotion: sanitizePromotionRow(row) };
}

async function getCouponSnapshot(couponId: string) {
  if (!uuidRe.test(couponId)) return { error: 'invalid_coupon_id' };
  const res = await query(`SELECT * FROM coupons WHERE id = $1 LIMIT 1`, [couponId]).catch(() => ({
    rows: [],
  }));
  const row = res.rows?.[0] as Record<string, unknown> | undefined;
  if (!row) return { found: false, couponId };
  return { found: true, coupon: sanitizeCouponRow(row) };
}

async function getCampaignSnapshot(campaignId: string) {
  const engine = getCampaignEngine();
  const campaign = await engine.getCampaign(campaignId);
  if (!campaign) return { found: false, campaignId };
  return {
    found: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      funding: campaign.funding,
      discountDomain: campaign.discountDomain,
      surface: campaign.surface,
      budgetCap: campaign.budgetCap,
      budgetSpent: campaign.budgetSpent,
      goal: campaign.goal,
      objective: campaign.objective,
      vendorId: campaign.vendorId,
      notificationMode: campaign.notificationMode,
      notificationCampaignId: campaign.notificationCampaignId,
      metadata: {
        businessObjective: campaign.metadata?.businessObjective,
        campaignHealth: campaign.metadata?.campaignHealth,
        timeline: campaign.metadata?.timeline,
      },
    },
  };
}

async function getCampaignHealthTool(campaignId: string) {
  const engine = getCampaignEngine();
  const health = await engine.getHealth(campaignId);
  if (!health) return { found: false, campaignId };
  return { found: true, health };
}

async function getCampaignAnalyticsTool(campaignId: string) {
  const engine = getCampaignEngine();
  const analytics = await engine.getCampaignAnalytics(campaignId);
  if (!analytics) return { found: false, campaignId };
  return { found: true, analytics };
}

async function getRuntimePolicySummary(domainRaw: string) {
  const domain =
    String(domainRaw || 'SERVICE').toUpperCase() === 'ECOMMERCE'
      ? DiscountDomain.ECOMMERCE
      : DiscountDomain.SERVICE;
  const active = (await getActivePolicyBundle()) as Awaited<
    ReturnType<typeof getActivePolicyBundle>
  > &
    Partial<DiscountPolicyBundle>;
  const runtime = loadRuntimePolicy(domain, {
    publishId: active.publishId,
    priority: active.priority,
    stack: active.stack,
    funding: active.funding,
    limits: active.limits,
    businessRules: active.businessRules,
  });
  return {
    domain,
    policyFingerprint: runtime.policyFingerprint,
    winningStrategy: (runtime.priority as { winningStrategy?: string })?.winningStrategy ?? runtime.priority,
    stack: runtime.stack,
    fundingDefaults: runtime.funding,
    published: true,
    note: 'Draft policy is not exposed — published runtime only.',
  };
}

async function getDiscountAnalyticsOverview(domainRaw: string) {
  if (!isAnalyticsEnabled()) {
    return { available: false, reason: 'DISCOUNT_ENGINE_V2_ANALYTICS_MODE not enabled' };
  }
  const engine = getAnalyticsEngine();
  const report = await engine.generateReport({});
  return {
    available: Boolean(report),
    domain: domainRaw || 'SERVICE',
    summary: report ? { generatedAt: new Date().toISOString() } : null,
    kpis: report ?? null,
  };
}

async function getCampaignSettlementAttribution(campaignId: string) {
  const engine = getCampaignEngine();
  const attribution = await engine.getSettlementAttribution(campaignId);
  if (!attribution) return { found: false, campaignId };
  return { found: true, attribution };
}

async function getCampaignNotificationLink(campaignId: string) {
  const engine = getCampaignEngine();
  const campaign = await engine.getCampaign(campaignId);
  if (!campaign) return { found: false, campaignId };
  return {
    found: true,
    notificationMode: campaign.notificationMode,
    notificationCampaignId: campaign.notificationCampaignId,
    linked: Boolean(campaign.notificationCampaignId),
  };
}

export async function executeCommercialCopilotToolRequests(
  requests: CommercialCopilotToolRequest[]
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  for (const req of requests) {
    switch (req.name) {
      case 'get_promotion_snapshot': {
        const id = pickId(req.args, 'promotionId', 'id');
        results.get_promotion_snapshot = await getPromotionSnapshot(id);
        break;
      }
      case 'get_coupon_snapshot': {
        const id = pickId(req.args, 'couponId', 'id');
        results.get_coupon_snapshot = await getCouponSnapshot(id);
        break;
      }
      case 'get_campaign_snapshot': {
        const id = pickId(req.args, 'campaignId', 'id');
        results.get_campaign_snapshot = await getCampaignSnapshot(id);
        break;
      }
      case 'get_campaign_health': {
        const id = pickId(req.args, 'campaignId', 'id');
        results.get_campaign_health = await getCampaignHealthTool(id);
        break;
      }
      case 'get_campaign_analytics': {
        const id = pickId(req.args, 'campaignId', 'id');
        results.get_campaign_analytics = await getCampaignAnalyticsTool(id);
        break;
      }
      case 'get_runtime_policy_summary': {
        const domain = pickId(req.args, 'domain') || 'SERVICE';
        results.get_runtime_policy_summary = await getRuntimePolicySummary(domain);
        break;
      }
      case 'get_discount_analytics_overview': {
        const domain = pickId(req.args, 'domain') || 'SERVICE';
        results.get_discount_analytics_overview = await getDiscountAnalyticsOverview(domain);
        break;
      }
      case 'get_campaign_settlement_attribution': {
        const id = pickId(req.args, 'campaignId', 'id');
        results.get_campaign_settlement_attribution = await getCampaignSettlementAttribution(id);
        break;
      }
      case 'get_campaign_notification_link': {
        const id = pickId(req.args, 'campaignId', 'id');
        results.get_campaign_notification_link = await getCampaignNotificationLink(id);
        break;
      }
      default:
        break;
    }
  }
  return results;
}

/** Auto-enrich tool requests from UI context entity. */
export function enrichToolRequestsFromContext(
  requests: CommercialCopilotToolRequest[],
  entity?: { type: string; id: string }
): CommercialCopilotToolRequest[] {
  if (!entity?.id) return requests;
  if (requests.length) return requests;
  const id = entity.id;
  if (entity.type === 'campaign') {
    return [{ name: 'get_campaign_snapshot', args: { campaignId: id } }];
  }
  if (entity.type === 'promotion') {
    return [{ name: 'get_promotion_snapshot', args: { promotionId: id } }];
  }
  if (entity.type === 'coupon') {
    return [{ name: 'get_coupon_snapshot', args: { couponId: id } }];
  }
  return requests;
}
