/**
 * @deprecated Legacy usage recorders — wrapped by V2 UsageTracker during Phase 8B migration.
 * Do not remove until Phase 8C cleanup.
 */
import { insert, query } from '../../database/rds-connection';
import {
  incrementCouponUsageCount,
  recordPlatformPromotionUsage,
  recordServicePromotionUsage,
  recordVendorPromotionUsage,
} from '../../utils/vendor-promotion-usage';
import { DiscountDomain } from '../enums/discount-domain';
import { DiscountOwner } from '../enums/discount-owner';
import { DiscountSource } from '../enums/discount-source';
import { DiscountTrigger } from '../enums/discount-trigger';
import type {
  CountDiscountUsageParams,
  RecordDiscountUsageParams,
  UsageTracker,
} from '../contracts/usage-tracker';
import type { UsagePreparedEntry } from '../resolver/types';

const recordedKeys = new Set<string>();

function usageKey(params: RecordDiscountUsageParams): string {
  return `${params.referenceType}:${params.referenceId}:${params.discountId}:${params.customerId}`;
}

/**
 * V2 usage tracker — delegates to existing legacy persistence (promotion_usages / coupon_usages).
 */
export class LegacyUsageTracker implements UsageTracker {
  async recordUsage(params: RecordDiscountUsageParams): Promise<void> {
    const key = usageKey(params);
    if (recordedKeys.has(key)) return;
    recordedKeys.add(key);

    const source = String(params.metadata?.source ?? '');
    const promotionType = String(params.metadata?.promotionType ?? '');

    if (source === DiscountSource.PLATFORM_COUPON || promotionType === 'coupon') {
      await this.recordCouponUsage(params);
      return;
    }

    if (params.referenceType === 'booking') {
      if (promotionType === 'platform' || source === DiscountSource.PLATFORM_PROMOTION) {
        await recordPlatformPromotionUsage({
          promotionId: params.discountId,
          bookingId: params.referenceId,
          customerId: params.customerId,
          discountAmount: params.discountAmount,
          originalAmount: Number(params.metadata?.originalAmount ?? 0),
        });
        return;
      }
      await recordServicePromotionUsage({
        promotionId: params.discountId,
        bookingId: params.referenceId,
        customerId: params.customerId,
        discountAmount: params.discountAmount,
        originalAmount: Number(params.metadata?.originalAmount ?? 0),
      });
      return;
    }

    if (params.referenceType === 'order') {
      await recordVendorPromotionUsage({
        promotionId: params.discountId,
        orderId: params.referenceId,
        customerId: params.customerId,
        discountAmount: params.discountAmount,
        orderSubtotal: Number(params.metadata?.originalAmount ?? 0),
      });
    }
  }

  private async recordCouponUsage(params: RecordDiscountUsageParams): Promise<void> {
    try {
      await insert('coupon_usages', {
        coupon_id: params.discountId,
        customer_id: params.customerId,
        booking_id: params.referenceType === 'booking' ? params.referenceId : null,
        order_id: params.referenceType === 'order' ? params.referenceId : null,
        discount_amount: params.discountAmount,
        used_at: new Date().toISOString(),
      });
      await incrementCouponUsageCount(params.discountId);
    } catch {
      /* coupon_usages may be missing in some envs */
    }
  }

  async countPriorUsage(params: CountDiscountUsageParams): Promise<number> {
    try {
      if (params.domain === DiscountDomain.ECOMMERCE) {
        const res = await query(
          `SELECT COUNT(*)::int AS c FROM promotion_usages
           WHERE promotion_id = $1::uuid AND customer_id = $2::uuid`,
          [params.discountId, params.customerId]
        );
        return res.rows[0]?.c ?? 0;
      }
      const res = await query(
        `SELECT COUNT(*)::int AS c FROM promotion_usages
         WHERE promotion_id = $1::uuid AND customer_id = $2::uuid`,
        [params.discountId, params.customerId]
      );
      return res.rows[0]?.c ?? 0;
    } catch {
      return 0;
    }
  }
}

let defaultTracker: LegacyUsageTracker | null = null;

export function getLegacyUsageTracker(): LegacyUsageTracker {
  if (!defaultTracker) {
    defaultTracker = new LegacyUsageTracker();
  }
  return defaultTracker;
}

export function resetLegacyUsageTrackerForTests(): void {
  recordedKeys.clear();
  defaultTracker = new LegacyUsageTracker();
}

/** Commit prepared usage entries from an authoritative resolver result. */
export async function commitResolverUsageEntries(params: {
  entries: UsagePreparedEntry[];
  customerId: string;
  referenceId: string;
  referenceType: 'booking' | 'order';
  originalAmount: number;
}): Promise<void> {
  const tracker = getLegacyUsageTracker();
  for (const entry of params.entries) {
    if (!entry.prepared || entry.discountAmount <= 0) continue;
    await tracker.recordUsage({
      discountId: entry.candidateId,
      customerId: params.customerId,
      domain: entry.domain as DiscountDomain,
      trigger: (entry.metadata?.trigger as DiscountTrigger) ?? DiscountTrigger.AUTO,
      referenceId: params.referenceId,
      referenceType: params.referenceType,
      discountAmount: entry.discountAmount,
      metadata: {
        ...entry.metadata,
        source: entry.source,
        promotionType:
          entry.source === DiscountSource.PLATFORM_COUPON
            ? 'coupon'
            : entry.owner === DiscountOwner.PLATFORM
              ? 'platform'
              : 'service',
        originalAmount: params.originalAmount,
      },
    });
  }
}
