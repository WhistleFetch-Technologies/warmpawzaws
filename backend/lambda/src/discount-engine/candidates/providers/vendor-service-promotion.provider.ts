import { query } from '../../database/rds-connection';
import { DiscountSource } from '../../enums/discount-source';
import type { CandidateLoadContext, CandidateProvider } from './types';

export class VendorServicePromotionCandidateProvider implements CandidateProvider {
  readonly source = DiscountSource.VENDOR_PROMOTION;

  async load(context: CandidateLoadContext): Promise<unknown[]> {
    if (context.preloadedRows?.length) {
      return context.preloadedRows;
    }
    if (!context.vendorId) return [];

    try {
      const res = await query(
        `SELECT * FROM vendor_service_promotions
         WHERE vendor_id = $1::uuid
           AND is_active = true
           AND start_date <= NOW()
           AND end_date >= NOW()
           AND (usage_limit IS NULL OR usage_count < usage_limit)`,
        [context.vendorId]
      );
      return (res as { rows?: unknown[] }).rows ?? [];
    } catch {
      return [];
    }
  }
}
