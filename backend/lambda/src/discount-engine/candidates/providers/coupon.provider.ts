import { select } from '../../database/rds-connection';
import { DiscountSource } from '../../enums/discount-source';
import type { CandidateLoadContext, CandidateProvider } from './types';

export class CouponCandidateProvider implements CandidateProvider {
  readonly source = DiscountSource.PLATFORM_COUPON;

  async load(context: CandidateLoadContext): Promise<unknown[]> {
    if (context.preloadedRows?.length) {
      return context.preloadedRows;
    }
    if (!context.code) return [];

    try {
      const rows = await select('coupons', {
        code: context.code.toUpperCase(),
        is_active: true,
      });
      return rows ?? [];
    } catch {
      return [];
    }
  }
}
