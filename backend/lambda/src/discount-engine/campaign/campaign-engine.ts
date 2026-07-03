import { campaignBuilder } from './campaign-builder';
import { buildCampaignAudit } from './campaign-audit';
import { assertLifecycleTransition } from './campaign-lifecycle';
import { resolveCampaignSchedule } from './campaign-scheduler';
import { globalCampaignRegistry } from './campaign-registry';
import {
  getCampaignMode,
  isCampaignAuthoritative,
  isCampaignEnabled,
  isCampaignShadowMode,
} from './campaign-mode';
import {
  getCampaignRepository,
  type CampaignRepository,
} from './repositories/campaign-repository';
import {
  createPromotionForCampaign,
  createCouponForCampaign,
  mockCreatePromotionForCampaign,
  mockCreateCouponForCampaign,
} from './integrations/promotion-bridge';
import { linkNotificationCampaign } from './integrations/notification-bridge';
import { fetchCampaignAnalytics } from './integrations/analytics-bridge';
import { buildSettlementAttribution } from './integrations/settlement-bridge';
import type {
  CampaignLifecycleStatus,
  CampaignOrchestrationResult,
  CampaignPromotionLink,
  CommercialCampaignRecord,
  CreateCampaignInput,
  OrchestrateCampaignInput,
} from './types';

export interface CampaignEngineOptions {
  repository?: CampaignRepository;
  /** When true, skip DB promotion/coupon inserts (tests). */
  dryRun?: boolean;
}

/**
 * Commercial Campaign Engine — pure orchestration.
 * Creates campaign metadata and coordinates Promotion, Coupon, Notification,
 * Analytics, and Settlement systems without calculating discounts.
 */
export class CampaignEngine {
  private readonly repository: CampaignRepository;
  private readonly dryRun: boolean;

  constructor(options: CampaignEngineOptions = {}) {
    this.repository = options.repository ?? getCampaignRepository();
    this.dryRun = options.dryRun ?? false;
  }

  getMode() {
    return getCampaignMode();
  }

  isEnabled(): boolean {
    return isCampaignEnabled();
  }

  /** Create draft campaign metadata. */
  async createCampaign(input: CreateCampaignInput): Promise<CommercialCampaignRecord> {
    const built = campaignBuilder.fromInput(input);
    const campaign = await this.repository.create(built.record);
    globalCampaignRegistry.register(campaign);
    return campaign;
  }

  async createFromTemplate(
    templateId: string,
    overrides: Partial<CreateCampaignInput> = {}
  ): Promise<CommercialCampaignRecord> {
    const built = campaignBuilder.fromTemplate(templateId, overrides);
    const campaign = await this.repository.create(built.record);
    globalCampaignRegistry.register(campaign);
    return campaign;
  }

  async getCampaign(id: string): Promise<CommercialCampaignRecord | null> {
    return this.repository.findById(id);
  }

  async listCampaigns(filters?: { status?: string; vendorId?: string }) {
    return this.repository.list(filters);
  }

  async transitionLifecycle(
    id: string,
    to: CampaignLifecycleStatus
  ): Promise<CommercialCampaignRecord | null> {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    assertLifecycleTransition(campaign.status, to);
    const updated = await this.repository.update(id, { status: to, version: campaign.version });
    if (updated) globalCampaignRegistry.register(updated);
    return updated;
  }

  /**
   * Orchestrates promotion/coupon creation, notification link, analytics preview, settlement attribution.
   * SHADOW: metadata + audit only (no promotion/coupon inserts unless dryRun false and authoritative).
   */
  async orchestrateCampaign(
    id: string,
    input: OrchestrateCampaignInput = {}
  ): Promise<CampaignOrchestrationResult | null> {
    if (!isCampaignEnabled()) {
      return null;
    }

    const started = Date.now();
    let campaign = await this.repository.findById(id);
    if (!campaign) throw new Error(`Campaign not found: ${id}`);

    const schedule = resolveCampaignSchedule({
      scheduleType: campaign.scheduleType,
      startAt: campaign.startAt,
      endAt: campaign.endAt,
      recurringRule: campaign.recurringRule,
    });

    const links: CampaignPromotionLink[] = await this.repository.getLinks(id);
    const promotionIds: string[] = links.filter((l) => l.promotionId).map((l) => l.promotionId!);
    const couponIds: string[] = links.filter((l) => l.couponId).map((l) => l.couponId!);

    const shouldMaterialize = isCampaignAuthoritative() && !this.dryRun && !isCampaignShadowMode();

    if (shouldMaterialize) {
      for (const promoBody of input.promotions ?? []) {
        const created = await createPromotionForCampaign(campaign, promoBody, schedule);
        const link = await this.repository.addLink({
          campaignId: id,
          promotionId: created.promotionId,
          linkType: 'promotion',
        });
        links.push(link);
        promotionIds.push(created.promotionId);
      }

      for (const couponBody of input.coupons ?? []) {
        const created = await createCouponForCampaign(campaign, couponBody);
        const link = await this.repository.addLink({
          campaignId: id,
          couponId: created.couponId,
          linkType: 'coupon',
        });
        links.push(link);
        couponIds.push(created.couponId);
      }
    } else if (isCampaignShadowMode() || this.dryRun) {
      // Shadow / dry-run — mock IDs for audit trail without DB writes to promotions
      for (const promoBody of input.promotions ?? []) {
        const created = await mockCreatePromotionForCampaign(campaign, promoBody);
        promotionIds.push(created.promotionId);
      }
      for (const couponBody of input.coupons ?? []) {
        const created = await mockCreateCouponForCampaign(campaign, couponBody);
        couponIds.push(created.couponId);
      }
    }

    const notification = await linkNotificationCampaign(campaign);
    if (notification.linked && notification.notificationCampaignId) {
      campaign =
        (await this.repository.update(id, {
          notificationCampaignId: notification.notificationCampaignId,
        })) ?? campaign;
    }

    const settlementAttribution = buildSettlementAttribution(campaign);
    const analyticsPreview = await fetchCampaignAnalytics(campaign, links);

    const audit = buildCampaignAudit({
      campaign,
      promotionIds,
      couponIds,
      analyticsPreview: analyticsPreview.report ?? undefined,
      settlementAttribution: settlementAttribution as unknown as Record<string, unknown>,
      startedAt: started,
    });

    await this.repository.saveAudit(id, audit);

    return {
      campaign,
      links,
      audit,
      analyticsPreview: analyticsPreview.report,
      settlementAttribution: settlementAttribution as unknown as Record<string, unknown>,
    };
  }

  async getCampaignAnalytics(id: string) {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    const links = await this.repository.getLinks(id);
    return fetchCampaignAnalytics(campaign, links);
  }

  async getSettlementAttribution(id: string) {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    return buildSettlementAttribution(campaign);
  }
}

let defaultEngine: CampaignEngine | null = null;

export function getCampaignEngine(options?: CampaignEngineOptions): CampaignEngine {
  if (!defaultEngine || options) {
    defaultEngine = new CampaignEngine(options);
  }
  return defaultEngine;
}

export function resetCampaignEngine(): void {
  defaultEngine = null;
}
