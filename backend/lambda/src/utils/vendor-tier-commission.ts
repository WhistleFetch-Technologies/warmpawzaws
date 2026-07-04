/**
 * Vendor subscription tier commission lookup (vendor_tiers table).
 * Shared by Razorpay splits and ecommerce commission resolver.
 */

import { query } from '../database/rds-connection';
import { DEFAULT_COMMISSION_RATE } from '../lib/constants/commission';

export async function getVendorTierCommission(vendorId: string): Promise<number> {
  try {
    const result = await query(
      `
      WITH vendor_tier_info AS (
        SELECT vt.commission_rate, 1 AS priority
        FROM vendor_tier_subscriptions vts
        JOIN vendor_tiers vt ON vts.tier_id = vt.id
        WHERE vts.vendor_id = $1
          AND vts.status = 'active'
          AND vts.expires_at > NOW()
        ORDER BY vts.created_at DESC
        LIMIT 1

        UNION ALL

        SELECT vt.commission_rate, 2 AS priority
        FROM vendors v
        JOIN vendor_tiers vt ON v.tier = vt.tier_name
        WHERE v.id = $1
          AND vt.is_active = true
        LIMIT 1

        UNION ALL

        SELECT commission_rate, 3 AS priority
        FROM vendor_tiers
        WHERE (is_default = true OR tier_name = 'Bronze')
          AND is_active = true
        ORDER BY is_default DESC, tier_level ASC
        LIMIT 1
      )
      SELECT commission_rate
      FROM vendor_tier_info
      ORDER BY priority ASC
      LIMIT 1
    `,
      [vendorId]
    );

    const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] }).rows || [];

    if (rows.length > 0 && (rows[0] as { commission_rate?: unknown }).commission_rate) {
      return parseFloat(String((rows[0] as { commission_rate: unknown }).commission_rate));
    }

    return DEFAULT_COMMISSION_RATE;
  } catch (error) {
    console.error('Error getting vendor tier commission:', error);
    return DEFAULT_COMMISSION_RATE;
  }
}
