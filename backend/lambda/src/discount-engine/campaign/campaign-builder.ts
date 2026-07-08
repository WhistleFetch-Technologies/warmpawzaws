import { getCampaignTemplate } from './campaign-template';
import { normalizeCampaignFunding } from './campaign-funding';
import { resolveCampaignSchedule } from './campaign-scheduler';
import { resolveCampaignType } from './campaign-configuration';
import { buildPolicyFingerprint } from './campaign-audit';
import {
  enrichAiReadyCampaignMetadata,
  resolveCampaignDiscountDomain,
  resolveCampaignSurface,
} from './campaign-domain';
import { DiscountFunding } from '../enums/discount-funding';
import type {
  CampaignAudience,
  CampaignFundingPolicy,
  CommercialCampaignRecord,
  CreateCampaignInput,
} from './types';

export interface BuiltCampaignDraft {
  record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'>;
}

/**
 * Builds campaign metadata from input or template — no promotion/coupon creation here.
 */
export class CampaignBuilder {
  fromInput(input: CreateCampaignInput): BuiltCampaignDraft {
    const campaignType = resolveCampaignType(input.campaignType);
    const template = input.templateId ? getCampaignTemplate(input.templateId) : null;

    const fundingResult = normalizeCampaignFunding(
      input.funding ?? template?.defaultFunding ?? { type: DiscountFunding.PLATFORM }
    );
    if (!fundingResult.valid) {
      throw new Error(fundingResult.errors.join('; '));
    }

    const schedule = resolveCampaignSchedule({
      scheduleType: input.scheduleType ?? template?.defaultScheduleType ?? 'immediate',
      startAt: input.startAt,
      endAt: input.endAt,
      recurringRule: input.recurringRule ?? template?.recurringRule,
    });

    const audience: CampaignAudience =
      input.audience ?? template?.audience ?? { kind: 'all_customers' };

    const funding: CampaignFundingPolicy = fundingResult.normalized;
    const version = 1;
    const policyFingerprint = buildPolicyFingerprint({
      campaignType,
      funding,
      audience,
      version,
    });

    const discountDomain = resolveCampaignDiscountDomain({
      discountDomain: input.discountDomain,
      surface: input.surface,
      metadata: input.metadata,
    });
    const surface = resolveCampaignSurface({
      surface: input.surface,
      discountDomain,
      metadata: input.metadata,
    });

    const partial = {
      funding,
      audience,
      discountDomain,
      surface,
      budgetCap: input.budgetCap ?? null,
      budgetSpent: 0,
      goal: input.goal ?? null,
      objective: input.objective ?? null,
      policyFingerprint,
      metadata: {
        ...(input.metadata ?? {}),
        builderSource: template ? 'template' : 'manual',
      },
    };

    return {
      record: {
        name: input.name,
        slug: input.name.toLowerCase().replace(/\s+/g, '-').slice(0, 80),
        campaignType,
        templateId: input.templateId ?? template?.id ?? null,
        status: 'draft',
        funding,
        scheduleType: schedule.scheduleType,
        startAt: schedule.startAt,
        endAt: schedule.endAt,
        recurringRule: schedule.recurringRule ?? null,
        audience,
        notificationMode: input.notificationMode ?? 'skip',
        notificationCampaignId: input.notificationCampaignId ?? null,
        vendorId: input.vendorId ?? null,
        version,
        discountDomain,
        surface,
        budgetCap: input.budgetCap ?? null,
        budgetSpent: 0,
        goal: input.goal ?? null,
        objective: input.objective ?? null,
        metadata: enrichAiReadyCampaignMetadata(partial, {
          builderSource: template ? 'template' : 'manual',
        }),
        policyFingerprint,
      },
    };
  }

  fromTemplate(templateId: string, overrides: Partial<CreateCampaignInput> = {}): BuiltCampaignDraft {
    const template = getCampaignTemplate(templateId);
    if (!template) throw new Error(`Unknown campaign template: ${templateId}`);
    return this.fromInput({
      name: overrides.name ?? template.name,
      campaignType: template.campaignType,
      templateId,
      ...overrides,
    });
  }
}

export const campaignBuilder = new CampaignBuilder();
