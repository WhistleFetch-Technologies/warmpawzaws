import { query } from '../../database/rds-connection';
import { DiscountSource } from '../../enums/discount-source';
import type { CandidateLoadContext, CandidateProvider } from './types';

export class PlatformPromotionCandidateProvider implements CandidateProvider {
  readonly source = DiscountSource.PLATFORM_PROMOTION;

  async load(context: CandidateLoadContext): Promise<unknown[]> {
    if (context.preloadedRows?.length) {
      return context.preloadedRows;
    }

    try {
      const res = await query(
        `SELECT * FROM promotions
         WHERE is_active = true
           AND published = true
           AND start_date <= CURRENT_DATE
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)`
      );
      return (res as { rows?: unknown[] }).rows ?? [];
    } catch {
      return [];
    }
  }
}
