import type { CampaignLifecycleStatus } from './types';

export const CAMPAIGN_ENGINE_VERSION = '1.0.0';

/** Configuration-driven campaign types — not hardcoded business logic branches. */
export const CAMPAIGN_TYPE_REGISTRY: Record<
  string,
  { label: string; defaultPromotionType: string; defaultTemplateId?: string }
> = {
  flash_sale: { label: 'Flash Sale', defaultPromotionType: 'flash_sale', defaultTemplateId: 'flash_sale' },
  seasonal: { label: 'Seasonal Campaign', defaultPromotionType: 'seasonal', defaultTemplateId: 'seasonal' },
  festival: { label: 'Festival Campaign', defaultPromotionType: 'seasonal', defaultTemplateId: 'festival' },
  weekend_offer: { label: 'Weekend Offer', defaultPromotionType: 'flash_sale', defaultTemplateId: 'weekend' },
  first_order: { label: 'First Order Campaign', defaultPromotionType: 'first_order', defaultTemplateId: 'first_order' },
  referral: { label: 'Referral Campaign', defaultPromotionType: 'referral', defaultTemplateId: 'referral' },
  launch: { label: 'Launch Campaign', defaultPromotionType: 'spotlight', defaultTemplateId: 'launch' },
  vendor_sponsored: { label: 'Vendor Sponsored', defaultPromotionType: 'flash_sale', defaultTemplateId: 'vendor_launch' },
  platform_sponsored: { label: 'Platform Sponsored', defaultPromotionType: 'spotlight', defaultTemplateId: 'platform' },
  shared: { label: 'Shared Campaign', defaultPromotionType: 'combo', defaultTemplateId: 'shared' },
  custom: { label: 'Custom Campaign', defaultPromotionType: 'flash_sale' },
};

export const CAMPAIGN_LIFECYCLE_TRANSITIONS: Record<string, CampaignLifecycleStatus[]> = {
  draft: ['review', 'cancelled', 'archived'],
  review: ['approved', 'draft', 'cancelled'],
  approved: ['scheduled', 'running', 'cancelled'],
  scheduled: ['running', 'paused', 'cancelled'],
  running: ['paused', 'completed', 'cancelled', 'expired'],
  paused: ['running', 'cancelled', 'archived'],
  completed: ['archived'],
  cancelled: ['archived'],
  expired: ['archived'],
  archived: [],
};

export function isKnownCampaignType(type: string): boolean {
  return Boolean(CAMPAIGN_TYPE_REGISTRY[type]);
}

export function resolveCampaignType(type: string): string {
  return isKnownCampaignType(type) ? type : 'custom';
}
