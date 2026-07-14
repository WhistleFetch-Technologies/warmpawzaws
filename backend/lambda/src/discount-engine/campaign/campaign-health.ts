import { isBudgetExhausted } from './campaign-domain';
import type { CampaignPromotionLink, CommercialCampaignRecord } from './types';

export type CampaignHealthStatus = 'healthy' | 'warning' | 'critical';

export interface CampaignHealthReport {
  status: CampaignHealthStatus;
  reasons: string[];
  checks: {
    budget: CampaignHealthStatus;
    schedule: CampaignHealthStatus;
    linkedOffers: CampaignHealthStatus;
    policy: CampaignHealthStatus;
    notification: CampaignHealthStatus;
    funding: CampaignHealthStatus;
    campaignState: CampaignHealthStatus;
  };
}

function worse(a: CampaignHealthStatus, b: CampaignHealthStatus): CampaignHealthStatus {
  const rank = { healthy: 0, warning: 1, critical: 2 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * Computes campaign health from budget, schedule, offers, policy, notification, funding, state.
 * Metadata-only signal for UI badges and future AI explanations — no pricing logic.
 */
export function evaluateCampaignHealth(
  campaign: CommercialCampaignRecord,
  links: CampaignPromotionLink[] = []
): CampaignHealthReport {
  const reasons: string[] = [];
  const checks: CampaignHealthReport['checks'] = {
    budget: 'healthy',
    schedule: 'healthy',
    linkedOffers: 'healthy',
    policy: 'healthy',
    notification: 'healthy',
    funding: 'healthy',
    campaignState: 'healthy',
  };

  const cap = campaign.budgetCap;
  const spent = Number(campaign.budgetSpent ?? 0);
  if (cap != null && Number.isFinite(Number(cap))) {
    const remaining = Number(cap) - spent;
    const ratio = Number(cap) > 0 ? spent / Number(cap) : 1;
    if (isBudgetExhausted(campaign) || remaining <= 0) {
      checks.budget = 'critical';
      reasons.push('Budget exhausted');
    } else if (ratio >= 0.85) {
      checks.budget = 'warning';
      reasons.push('Budget nearly exhausted (≥85%)');
    }
  }

  const now = Date.now();
  if (campaign.endAt) {
    const end = new Date(campaign.endAt).getTime();
    if (Number.isFinite(end) && end < now && ['scheduled', 'running', 'approved'].includes(campaign.status)) {
      checks.schedule = 'critical';
      reasons.push('Campaign end date has passed while still active');
    } else if (
      Number.isFinite(end) &&
      end - now < 48 * 60 * 60 * 1000 &&
      end > now &&
      campaign.status === 'running'
    ) {
      checks.schedule = 'warning';
      reasons.push('Campaign ends within 48 hours');
    }
  }
  if (campaign.startAt && campaign.endAt) {
    const start = new Date(campaign.startAt).getTime();
    const end = new Date(campaign.endAt).getTime();
    if (Number.isFinite(start) && Number.isFinite(end) && end < start) {
      checks.schedule = 'critical';
      reasons.push('Invalid schedule: end before start');
    }
  }

  const activeLinks = links.filter((l) => l.isActive !== false);
  if (['approved', 'scheduled', 'running'].includes(campaign.status) && activeLinks.length === 0) {
    checks.linkedOffers = 'critical';
    reasons.push('No linked offers');
  } else if (links.length > 0 && activeLinks.length < links.length) {
    checks.linkedOffers = 'warning';
    reasons.push('Some linked offers are inactive');
  }

  if (!campaign.policyFingerprint) {
    checks.policy = 'warning';
    reasons.push('Missing policy fingerprint');
  }

  if (campaign.notificationMode === 'link' && !campaign.notificationCampaignId) {
    checks.notification = 'warning';
    reasons.push('Notification link mode missing notification campaign id');
  }
  if (campaign.notificationMode === 'create' && !campaign.notificationCampaignId) {
    checks.notification = 'warning';
    reasons.push('Notification create pending (not yet materialised)');
  }

  const funding = campaign.funding;
  if (
    (funding.type === 'SHARED' || funding.type === 'CUSTOM') &&
    (!funding.split ||
      Number(funding.split.platformPercent) + Number(funding.split.vendorPercent) !== 100)
  ) {
    checks.funding = 'critical';
    reasons.push('Invalid funding split');
  }

  if (['cancelled', 'expired'].includes(campaign.status)) {
    checks.campaignState = 'warning';
    reasons.push(`Campaign is ${campaign.status}`);
  }
  if (campaign.status === 'paused' && isBudgetExhausted(campaign)) {
    checks.campaignState = 'critical';
    reasons.push('Paused due to budget exhaustion');
  }

  let status: CampaignHealthStatus = 'healthy';
  for (const value of Object.values(checks)) {
    status = worse(status, value);
  }

  return { status, reasons, checks };
}
