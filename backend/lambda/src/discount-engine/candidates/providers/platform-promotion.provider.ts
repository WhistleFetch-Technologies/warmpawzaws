import { query } from '../../../database/rds-connection';
import { DiscountSource } from '../../enums/discount-source';
import type { CandidateLoadContext, CandidateProvider } from './types';

export class PlatformPromotionCandidateProvider implements CandidateProvider {
  readonly source = DiscountSource.PLATFORM_PROMOTION;

  async load(context: CandidateLoadContext): Promise<unknown[]> {
    if (context.preloadedRows?.length) {
      return context.preloadedRows;
    }

    try {
      let queryStr = `SELECT * FROM promotions
         WHERE is_active = true
           AND published = true
           AND start_date <= CURRENT_DATE
           AND (end_date IS NULL OR end_date >= CURRENT_DATE)
         AND (usage_limit IS NULL OR usage_count < usage_limit)
         AND (max_uses IS NULL OR usage_count < max_uses)`;
      const params: unknown[] = [];
      if (context.code) {
        queryStr += ` AND UPPER(code) = $1`;
        params.push(context.code.toUpperCase());
      }
      const res = await query(queryStr, params);
      return (res as { rows?: unknown[] }).rows ?? [];
    } catch {
      return [];
    }
  }
}
