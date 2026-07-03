import { DiscountFunding } from '../enums/discount-funding';
import type { CampaignTemplateDefinition } from './types-template';

export type { CampaignTemplateDefinition } from './types-template';

/** Reusable templates — metadata only; promotions created via Promotion Engine. */
export const CAMPAIGN_TEMPLATES: Record<string, CampaignTemplateDefinition> = {
  flash_sale: {
    id: 'flash_sale',
    name: 'Flash Sale',
    campaignType: 'flash_sale',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'immediate',
    promotionDefaults: {
      type: 'flash_sale',
      is_active: true,
    },
  },
  weekend: {
    id: 'weekend',
    name: 'Weekend Offer',
    campaignType: 'weekend_offer',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'recurring',
    recurringRule: { frequency: 'weekly', daysOfWeek: [5, 6] },
    promotionDefaults: { type: 'flash_sale' },
  },
  holiday: {
    id: 'holiday',
    name: 'Holiday Campaign',
    campaignType: 'seasonal',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'seasonal' },
  },
  black_friday: {
    id: 'black_friday',
    name: 'Black Friday',
    campaignType: 'seasonal',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'flash_sale' },
  },
  christmas: {
    id: 'christmas',
    name: 'Christmas',
    campaignType: 'festival',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'seasonal' },
  },
  new_year: {
    id: 'new_year',
    name: 'New Year',
    campaignType: 'festival',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'seasonal' },
  },
  summer_sale: {
    id: 'summer_sale',
    name: 'Summer Sale',
    campaignType: 'seasonal',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'seasonal' },
  },
  pet_health_week: {
    id: 'pet_health_week',
    name: 'Pet Health Week',
    campaignType: 'seasonal',
    defaultFunding: { type: DiscountFunding.SHARED, split: { platformPercent: 50, vendorPercent: 50 } },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'spotlight' },
  },
  vendor_launch: {
    id: 'vendor_launch',
    name: 'Vendor Launch',
    campaignType: 'vendor_sponsored',
    defaultFunding: { type: DiscountFunding.VENDOR },
    defaultScheduleType: 'immediate',
    promotionDefaults: { type: 'spotlight' },
  },
  first_order: {
    id: 'first_order',
    name: 'First Order',
    campaignType: 'first_order',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'immediate',
    promotionDefaults: { type: 'first_order' },
    audience: { kind: 'first_order' },
  },
  festival: {
    id: 'festival',
    name: 'Festival',
    campaignType: 'festival',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'seasonal' },
  },
  referral: {
    id: 'referral',
    name: 'Referral',
    campaignType: 'referral',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'immediate',
    promotionDefaults: { type: 'referral' },
  },
  launch: {
    id: 'launch',
    name: 'Launch',
    campaignType: 'launch',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'immediate',
    promotionDefaults: { type: 'spotlight' },
  },
  platform: {
    id: 'platform',
    name: 'Platform Sponsored',
    campaignType: 'platform_sponsored',
    defaultFunding: { type: DiscountFunding.PLATFORM },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'spotlight' },
  },
  shared: {
    id: 'shared',
    name: 'Shared Funding',
    campaignType: 'shared',
    defaultFunding: { type: DiscountFunding.SHARED, split: { platformPercent: 50, vendorPercent: 50 } },
    defaultScheduleType: 'scheduled',
    promotionDefaults: { type: 'combo' },
  },
};

export function getCampaignTemplate(templateId: string): CampaignTemplateDefinition | null {
  return CAMPAIGN_TEMPLATES[templateId] ?? null;
}

export function listCampaignTemplates(): CampaignTemplateDefinition[] {
  return Object.values(CAMPAIGN_TEMPLATES);
}
