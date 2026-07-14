/**
 * Synchronize linked promotion/coupon active flags with campaign lifecycle.
 * Campaigns orchestrate offers — they do not price them.
 */
import { query } from '../../database/rds-connection';
import type { CampaignLifecycleStatus, CampaignPromotionLink } from './types';

const DEACTIVATE_STATUSES = new Set<CampaignLifecycleStatus>([
  'paused',
  'completed',
  'cancelled',
  'expired',
  'archived',
]);

const ACTIVATE_STATUSES = new Set<CampaignLifecycleStatus>(['running', 'scheduled']);

export function shouldDeactivateOffersForLifecycle(status: CampaignLifecycleStatus): boolean {
  return DEACTIVATE_STATUSES.has(status);
}

export function shouldActivateOffersForLifecycle(status: CampaignLifecycleStatus): boolean {
  return ACTIVATE_STATUSES.has(status);
}

export async function setLinkedOffersActive(
  links: CampaignPromotionLink[],
  isActive: boolean
): Promise<{ promotionsUpdated: number; couponsUpdated: number }> {
  let promotionsUpdated = 0;
  let couponsUpdated = 0;

  for (const link of links) {
    if (link.isActive === false && isActive) {
      // Detached links stay inactive until re-attached
      continue;
    }
    if (link.promotionId) {
      await query(`UPDATE promotions SET is_active = $2, updated_at = NOW() WHERE id = $1`, [
        link.promotionId,
        isActive,
      ]);
      promotionsUpdated += 1;
    }
    if (link.couponId) {
      await query(`UPDATE coupons SET is_active = $2 WHERE id = $1`, [link.couponId, isActive]);
      couponsUpdated += 1;
    }
  }

  return { promotionsUpdated, couponsUpdated };
}

export async function syncOffersForLifecycle(
  links: CampaignPromotionLink[],
  status: CampaignLifecycleStatus
): Promise<{ promotionsUpdated: number; couponsUpdated: number; action: 'activate' | 'deactivate' | 'none' }> {
  const activeLinks = links.filter((l) => l.isActive !== false);
  if (shouldDeactivateOffersForLifecycle(status)) {
    const result = await setLinkedOffersActive(activeLinks, false);
    return { ...result, action: 'deactivate' };
  }
  if (shouldActivateOffersForLifecycle(status)) {
    const result = await setLinkedOffersActive(activeLinks, true);
    return { ...result, action: 'activate' };
  }
  return { promotionsUpdated: 0, couponsUpdated: 0, action: 'none' };
}
