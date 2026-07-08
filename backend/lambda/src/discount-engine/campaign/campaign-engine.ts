import { campaignBuilder } from './campaign-builder';
import { buildCampaignAudit } from './campaign-audit';
import { assertLifecycleTransition } from './campaign-lifecycle';
import { resolveCampaignSchedule } from './campaign-scheduler';
import { globalCampaignRegistry } from './campaign-registry';
import { enrichAiReadyCampaignMetadata, isBudgetExhausted } from './campaign-domain';
import { syncOffersForLifecycle } from './campaign-offer-sync';
import { evaluateCampaignHealth } from './campaign-health';
import { validateCampaignForPublish } from './campaign-validation';
import { notifyCampaignEnrollment } from './campaign-enrollment-notify';
import {
  getCampaignMode,
  isCampaignAuthoritative,
  isCampaignEnabled,
  isCampaignShadowMode,
} from './campaign-mode';
import {
  getCampaignRepository,
  type CampaignListFilters,
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
  AttachCampaignOffersInput,
  CampaignLifecycleStatus,
  CampaignOrchestrationResult,
  CampaignPromotionLink,
  CommercialCampaignRecord,
  CreateCampaignInput,
  OrchestrateCampaignInput,
} from './types';

export interface DuplicateCampaignOptions {
  includeSchedule?: boolean;
  nameSuffix?: string;
}

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

  async listCampaigns(filters?: CampaignListFilters) {
    return this.repository.list(filters);
  }

  async transitionLifecycle(
    id: string,
    to: CampaignLifecycleStatus
  ): Promise<CommercialCampaignRecord | null> {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    assertLifecycleTransition(campaign.status, to);

    const publishStatuses: CampaignLifecycleStatus[] = ['approved', 'scheduled', 'running'];
    if (publishStatuses.includes(to) && !publishStatuses.includes(campaign.status)) {
      const links = await this.repository.getLinks(id, { includeInactive: true });
      const validation = await validateCampaignForPublish(campaign, links);
      if (!validation.valid) {
        throw new Error(
          `Campaign publish validation failed: ${validation.errors.map((e) => e.message).join('; ')}`
        );
      }
      // Overlaps warn in validation response / audit metadata — do not block unless forced elsewhere
      if (validation.warnings.length) {
        console.warn(
          `[campaign] publish warnings for ${id}:`,
          validation.warnings.map((w) => w.message).join('; ')
        );
      }
    }

    if (to === 'running' && isBudgetExhausted(campaign)) {
      throw new Error('Campaign budget exhausted — cannot resume until budget is increased');
    }

    const timelineEntry = {
      status: to,
      at: new Date().toISOString(),
      from: campaign.status,
    };
    const priorTimeline = Array.isArray(campaign.metadata?.timeline)
      ? [...(campaign.metadata.timeline as unknown[])]
      : [];
    priorTimeline.push(timelineEntry);

    const linksForHealth = await this.repository.getLinks(id, { includeInactive: true });
    const health = evaluateCampaignHealth({ ...campaign, status: to }, linksForHealth);

    const updated = await this.repository.update(id, {
      status: to,
      version: campaign.version,
      metadata: enrichAiReadyCampaignMetadata(
        { ...campaign, status: to, healthStatus: health.status, timeline: priorTimeline },
        {
          timeline: priorTimeline,
          campaignHealth: health,
        }
      ),
    });
    if (!updated) return null;

    const links = await this.repository.getLinks(id, { includeInactive: false });
    await syncOffersForLifecycle(links, to);

    if (publishStatuses.includes(to) && !publishStatuses.includes(campaign.status)) {
      await notifyCampaignEnrollment(updated).catch((err) =>
        console.warn('[campaign] enrollment notify failed', err)
      );
    }

    globalCampaignRegistry.register(updated);
    return updated;
  }

  async validateForPublish(id: string) {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    const links = await this.repository.getLinks(id, { includeInactive: true });
    return validateCampaignForPublish(campaign, links);
  }

  async getHealth(id: string) {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    const links = await this.repository.getLinks(id, { includeInactive: true });
    return evaluateCampaignHealth(campaign, links);
  }

  /**
   * Duplicate campaign into a new Draft — copies schedule (optional), funding,
   * audience, offer links, notification settings, goal, budget. Resets spend.
   */
  async duplicateCampaign(
    id: string,
    options: DuplicateCampaignOptions = {}
  ): Promise<CommercialCampaignRecord | null> {
    const source = await this.repository.findById(id);
    if (!source) return null;
    const includeSchedule = options.includeSchedule !== false;
    const links = await this.repository.getLinks(id, { includeInactive: false });

    const created = await this.createCampaign({
      name: `${source.name}${options.nameSuffix ?? ' (Copy)'}`,
      campaignType: source.campaignType,
      templateId: source.templateId ?? undefined,
      funding: source.funding,
      scheduleType: includeSchedule ? source.scheduleType : 'immediate',
      startAt: includeSchedule ? source.startAt ?? undefined : undefined,
      endAt: includeSchedule ? source.endAt ?? undefined : undefined,
      recurringRule: includeSchedule ? source.recurringRule ?? undefined : undefined,
      audience: source.audience,
      notificationMode: source.notificationMode,
      notificationCampaignId: source.notificationCampaignId ?? undefined,
      vendorId: source.vendorId ?? undefined,
      discountDomain: source.discountDomain,
      surface: source.surface,
      budgetCap: source.budgetCap ?? null,
      goal: source.goal ?? null,
      objective: source.objective ?? null,
      metadata: {
        ...(source.metadata ?? {}),
        duplicatedFrom: source.id,
        businessObjective: source.metadata?.businessObjective ?? source.objective ?? source.goal,
        expectedOutcome: source.metadata?.expectedOutcome ?? null,
        owner: source.metadata?.owner ?? source.vendorId ?? 'platform',
        notes: source.metadata?.notes ?? null,
        successCriteria: source.metadata?.successCriteria ?? null,
        timeline: [{ status: 'draft', at: new Date().toISOString(), from: null }],
      },
    });

    if (links.length) {
      await this.attachOffers(created.id, {
        promotionIds: links.map((l) => l.promotionId).filter(Boolean) as string[],
        couponIds: links.map((l) => l.couponId).filter(Boolean) as string[],
      });
    }

    return this.repository.findById(created.id);
  }

  /** Attach existing platform promotions/coupons to a campaign (no duplicate create). */
  async attachOffers(
    id: string,
    input: AttachCampaignOffersInput
  ): Promise<{ campaign: CommercialCampaignRecord; links: CampaignPromotionLink[] } | null> {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    const links = await this.repository.getLinks(id, { includeInactive: true });

    for (const promotionId of input.promotionIds ?? []) {
      const exists = links.some((l) => l.promotionId === promotionId && l.isActive !== false);
      if (exists) continue;
      const link = await this.repository.addLink({
        campaignId: id,
        promotionId,
        linkType: 'promotion',
        isActive: true,
      });
      links.push(link);
    }

    for (const couponId of input.couponIds ?? []) {
      const exists = links.some((l) => l.couponId === couponId && l.isActive !== false);
      if (exists) continue;
      const link = await this.repository.addLink({
        campaignId: id,
        couponId,
        linkType: 'coupon',
        isActive: true,
      });
      links.push(link);
    }

    const active = links.filter((l) => l.isActive !== false);
    if (['approved', 'scheduled', 'running'].includes(campaign.status)) {
      await notifyCampaignEnrollment(campaign).catch((err) =>
        console.warn('[campaign] enrollment notify on attach failed', err)
      );
    }

    return {
      campaign,
      links: active,
    };
  }

  async detachOffer(
    id: string,
    opts: { promotionId?: string; couponId?: string }
  ): Promise<boolean> {
    return this.repository.detachLink(id, opts);
  }

  /**
   * Record campaign spend (discount $ attributed). Auto-pauses when budget exhausted.
   * Settlement / analytics callers invoke this — no pricing logic here.
   */
  async recordCampaignSpend(
    id: string,
    amount: number
  ): Promise<CommercialCampaignRecord | null> {
    const campaign = await this.repository.findById(id);
    if (!campaign) return null;
    const nextSpent = Number(campaign.budgetSpent ?? 0) + Math.max(0, Number(amount) || 0);
    let updated = await this.repository.update(id, { budgetSpent: nextSpent });
    if (updated && isBudgetExhausted(updated) && updated.status === 'running') {
      updated = await this.transitionLifecycle(id, 'paused');
    }
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
