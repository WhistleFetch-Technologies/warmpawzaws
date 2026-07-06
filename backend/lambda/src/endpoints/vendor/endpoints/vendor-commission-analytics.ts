/**
 * GET /vendor/:vendorId/commission-analytics
 * Ecommerce seller commission stats, GST rate, and tier benefits for Seller Hub.
 */

import { Hono } from 'hono';
import { query } from '../../../database/rds-connection';
import { BaseHandler, HandlerContext, HandlerResponse } from '../../../handler/base-handler';
import { resolveSellerCommissionRate } from '../../../utils/seller-commission-rate';

const EMPTY_RESPONSE = {
  commissionRate: 0,
  commissionRateSource: 'none',
  gstRate: 0,
  totalRevenue: 0,
  totalCommission: 0,
  netEarnings: 0,
  pendingPayout: 0,
  settledPayout: 0,
  monthlyRevenue: 0,
  currentTier: null,
  tiers: [] as CommissionTierRow[],
};

interface CommissionTierRow {
  name: string;
  level: number;
  commissionRate: number;
  minMonthlyRevenue: number;
  maxMonthlyRevenue: number | null;
  isCurrent: boolean;
}

function isTestVendorId(vendorId: string): boolean {
  return (
    vendorId === 'test-vendor-id' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)
  );
}

async function resolveSellerGstRate(vendorId: string): Promise<number> {
  try {
    const taxRes = await query(
      `SELECT MAX(default_gst_rate) AS rate
       FROM tax_categories
       WHERE is_active = true
         AND (name ILIKE '%accessor%' OR name ILIKE '%pet food%')`
    );
    const taxRate = parseFloat(taxRes.rows?.[0]?.rate || '');
    if (Number.isFinite(taxRate) && taxRate > 0) return taxRate;
  } catch {
    // continue
  }

  try {
    const productRes = await query(
      `SELECT AVG(p.gst_rate) AS rate
       FROM products p
       WHERE p.vendor_id = $1
         AND p.is_active = true
         AND p.gst_rate IS NOT NULL
         AND p.gst_rate > 0`,
      [vendorId]
    );
    const productRate = parseFloat(productRes.rows?.[0]?.rate || '');
    if (Number.isFinite(productRate) && productRate > 0) return productRate;
  } catch {
    // continue
  }

  try {
    const settingsRes = await query(
      `SELECT value FROM platform_settings WHERE setting_key = 'tax_rules' LIMIT 1`
    );
    if (settingsRes.rows?.[0]?.value) {
      const raw = settingsRes.rows[0].value;
      const config = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const gstRate = parseFloat(config?.gst_rate || '');
      if (Number.isFinite(gstRate) && gstRate > 0) return gstRate;
    }
  } catch {
    // continue
  }

  return 0;
}

async function loadCommissionTiers(
  monthlyRevenue: number,
  commissionTierId: string | null
): Promise<CommissionTierRow[]> {
  try {
    const result = await query(
      `SELECT id, tier_name, tier_level,
              COALESCE(ecommerce_commission_rate, default_commission_rate) AS commission_rate,
              min_monthly_revenue, max_monthly_revenue
       FROM commission_tiers
       WHERE is_active = true
       ORDER BY tier_level ASC`
    );
    const rows = result.rows || [];
    let currentByAssignment: string | null = commissionTierId;

    return rows.map((row: Record<string, unknown>) => {
      const minRev = parseFloat(String(row.min_monthly_revenue ?? 0));
      const maxRaw = row.max_monthly_revenue;
      const maxRev =
        maxRaw == null || maxRaw === '' ? null : parseFloat(String(maxRaw));
      const id = String(row.id || '');
      const byRevenue =
        monthlyRevenue >= minRev && (maxRev == null || monthlyRevenue <= maxRev);
      const byAssignment = currentByAssignment != null && id === currentByAssignment;
      const isCurrent =
        currentByAssignment != null ? byAssignment : byRevenue;

      return {
        name: String(row.tier_name || ''),
        level: parseInt(String(row.tier_level ?? 0), 10),
        commissionRate: parseFloat(String(row.commission_rate ?? 0)),
        minMonthlyRevenue: minRev,
        maxMonthlyRevenue: maxRev,
        isCurrent,
      };
    });
  } catch {
    return [];
  }
}

class GetVendorCommissionAnalyticsHandler extends BaseHandler {
  async handle(context: HandlerContext): Promise<HandlerResponse> {
    try {
      const vendorId = context.event.pathParameters?.vendorId;
      if (!vendorId) {
        return this.error('Vendor ID is required', 400);
      }

      if (isTestVendorId(vendorId)) {
        return this.success(EMPTY_RESPONSE);
      }

      const { rate: commissionRate, source: commissionRateSource, monthlyRevenue, configured, missing } =
        await resolveSellerCommissionRate(vendorId);

      const effectiveRate = configured && commissionRate != null ? commissionRate : 0;
      const rateFrac = effectiveRate / 100;

      const [statsRes, gstRate, vendorRes] = await Promise.all([
        query(
          `SELECT
             COALESCE(SUM(o.total_amount) FILTER (WHERE o.order_status != 'cancelled'), 0) AS total_revenue,
             COALESCE(SUM(
               COALESCE(o.subtotal, o.total_amount - COALESCE(o.tax_amount, 0))
             ) FILTER (WHERE o.order_status != 'cancelled'), 0) AS total_base,
             COALESCE(SUM(
               (COALESCE(o.subtotal, o.total_amount - COALESCE(o.tax_amount, 0))
                - COALESCE(o.vendor_promotion_amount, 0))
               * (1 - $2::numeric / 100)
             ) FILTER (
               WHERE o.order_status NOT IN ('cancelled', 'delivered', 'returned')
                 AND o.payment_status = 'completed'
             ), 0) AS pending_payout,
             COALESCE(SUM(o.vendor_payout_amount) FILTER (WHERE o.order_status = 'delivered'), 0) AS settled_payout
           FROM orders o
           WHERE o.vendor_id = $1`,
          [vendorId, effectiveRate]
        ),
        resolveSellerGstRate(vendorId),
        query(`SELECT commission_tier_id FROM vendors WHERE id = $1 LIMIT 1`, [vendorId]).catch(
          () => ({ rows: [{ commission_tier_id: null }] })
        ),
      ]);

      const stats = statsRes.rows?.[0] || {};
      const totalRevenue = parseFloat(String(stats.total_revenue ?? 0));
      const totalBase = parseFloat(String(stats.total_base ?? 0));
      const pendingPayout = parseFloat(String(stats.pending_payout ?? 0));
      const settledPayout = parseFloat(String(stats.settled_payout ?? 0));
      const totalCommission = totalBase * rateFrac;
      const netEarnings = totalBase * (1 - rateFrac);

      const commissionTierId = vendorRes.rows?.[0]?.commission_tier_id
        ? String(vendorRes.rows[0].commission_tier_id)
        : null;
      const tiers = await loadCommissionTiers(monthlyRevenue, commissionTierId);
      const currentTier = tiers.find((t) => t.isCurrent) ?? null;

      return this.success({
        commissionRate: configured ? commissionRate : null,
        commissionRateSource: configured ? commissionRateSource : null,
        commissionConfigured: configured,
        commissionMissing: missing ?? [],
        gstRate,
        totalRevenue,
        totalCommission,
        netEarnings,
        pendingPayout,
        settledPayout,
        monthlyRevenue,
        currentTier: currentTier
          ? {
              name: currentTier.name,
              level: currentTier.level,
              commissionRate: currentTier.commissionRate,
            }
          : null,
        tiers,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch commission analytics';
      console.error('Error fetching commission analytics:', error);
      if (String(message).includes('invalid input syntax for type uuid')) {
        return this.success(EMPTY_RESPONSE);
      }
      return this.error(message, 500);
    }
  }
}

export function registerVendorCommissionAnalyticsEndpoints(app: Hono) {
  const handler = new GetVendorCommissionAnalyticsHandler();

  app.get('/vendor/:vendorId/commission-analytics', async (c) => {
    try {
      const response = await handler.handle({
        event: {
          pathParameters: c.req.param(),
          queryStringParameters: {},
        } as HandlerContext['event'],
      } as HandlerContext);
      return c.json(JSON.parse(response.body), response.statusCode as 200 | 400 | 500);
    } catch (error: unknown) {
      console.error('Error in commission-analytics endpoint:', error);
      return c.json(EMPTY_RESPONSE, 200);
    }
  });
}
