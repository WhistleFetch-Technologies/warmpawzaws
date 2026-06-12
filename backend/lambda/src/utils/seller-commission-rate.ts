import { query } from '../database/rds-connection';
import { getVendorTierCommission } from '../endpoints/razorpay/endpoints/razorpay.razorpay';
import { DEFAULT_COMMISSION_RATE } from '../lib/constants/commission';

export interface SellerCommissionRateResult {
  rate: number;
  source: string;
  monthlyRevenue: number;
}

function normalizeRate(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

async function getEcommerceCommissionSettings(): Promise<{
  defaultRate: number | null;
  sellerRates: Record<string, unknown>;
}> {
  try {
    const result = await query(
      `SELECT default_rate, seller_rates FROM ecommerce_commission_settings WHERE setting_key = 'default' LIMIT 1`
    );
    const row = result.rows?.[0];
    if (row) {
      const raw = row.seller_rates;
      const sellerRates =
        typeof raw === 'string' ? (JSON.parse(raw) as Record<string, unknown>) : (raw || {});
      return {
        defaultRate: normalizeRate(row.default_rate),
        sellerRates: sellerRates as Record<string, unknown>,
      };
    }
  } catch {
    // table may not exist on older DBs
  }
  return { defaultRate: null, sellerRates: {} };
}

async function getVendorCommissionTierRate(vendorId: string): Promise<number | null> {
  try {
    const result = await query(
      `SELECT COALESCE(ct.ecommerce_commission_rate, ct.default_commission_rate) AS rate
       FROM vendors v
       LEFT JOIN commission_tiers ct ON v.commission_tier_id = ct.id AND ct.is_active = true
       WHERE v.id = $1
       LIMIT 1`,
      [vendorId]
    );
    return normalizeRate(result.rows?.[0]?.rate);
  } catch {
    return null;
  }
}

export async function getSellerMonthlyRevenue(vendorId: string): Promise<number> {
  try {
    const revenueRes = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS revenue
       FROM orders
       WHERE vendor_id = $1
         AND order_status != 'cancelled'
         AND created_at >= DATE_TRUNC('month', CURRENT_DATE)`,
      [vendorId]
    );
    return parseFloat(revenueRes.rows?.[0]?.revenue || '0');
  } catch {
    return 0;
  }
}

async function getMonthlyRevenueAutoTierRate(
  vendorId: string,
  monthlyRevenue?: number
): Promise<number | null> {
  const revenue = monthlyRevenue ?? (await getSellerMonthlyRevenue(vendorId));
  try {
    const tierRes = await query(
      `SELECT COALESCE(ecommerce_commission_rate, default_commission_rate) AS rate
       FROM commission_tiers
       WHERE is_active = true
         AND min_monthly_revenue <= $2
         AND (max_monthly_revenue IS NULL OR max_monthly_revenue >= $2)
       ORDER BY tier_level DESC
       LIMIT 1`,
      [vendorId, revenue]
    );
    return normalizeRate(tierRes.rows?.[0]?.rate);
  } catch {
    // max_monthly_revenue column may be absent on some DBs
    try {
      const tierRes = await query(
        `SELECT COALESCE(ecommerce_commission_rate, default_commission_rate) AS rate
         FROM commission_tiers
         WHERE is_active = true
           AND min_monthly_revenue <= $2
         ORDER BY tier_level DESC
         LIMIT 1`,
        [vendorId, revenue]
      );
      return normalizeRate(tierRes.rows?.[0]?.rate);
    } catch {
      return null;
    }
  }
}

async function getVendorCommissionPercentage(vendorId: string): Promise<number | null> {
  try {
    const result = await query(
      `SELECT commission_percentage FROM vendors WHERE id = $1 LIMIT 1`,
      [vendorId]
    );
    return normalizeRate(result.rows?.[0]?.commission_percentage);
  } catch {
    return null;
  }
}

/**
 * Layered ecommerce seller commission rate resolution.
 * Priority: seller_rates override → assigned commission_tier → revenue auto-tier
 * → Razorpay vendor_tiers → ecommerce default_rate → vendors.commission_percentage → platform default.
 */
export async function resolveSellerCommissionRate(
  vendorId: string
): Promise<SellerCommissionRateResult> {
  const monthlyRevenue = await getSellerMonthlyRevenue(vendorId);
  const { defaultRate, sellerRates } = await getEcommerceCommissionSettings();

  const override = normalizeRate(sellerRates[vendorId] ?? sellerRates[String(vendorId)]);
  if (override != null) {
    return { rate: override, source: 'seller_rates_override', monthlyRevenue };
  }

  const assignedTierRate = await getVendorCommissionTierRate(vendorId);
  if (assignedTierRate != null) {
    return { rate: assignedTierRate, source: 'commission_tier_assignment', monthlyRevenue };
  }

  const autoTierRate = await getMonthlyRevenueAutoTierRate(vendorId, monthlyRevenue);
  if (autoTierRate != null) {
    return { rate: autoTierRate, source: 'commission_tier_revenue', monthlyRevenue };
  }

  try {
    const razorpayRate = await getVendorTierCommission(vendorId);
    if (razorpayRate != null && razorpayRate > 0) {
      return { rate: razorpayRate, source: 'vendor_tiers_razorpay', monthlyRevenue };
    }
  } catch {
    // fall through
  }

  if (defaultRate != null) {
    return { rate: defaultRate, source: 'ecommerce_default_rate', monthlyRevenue };
  }

  const profileRate = await getVendorCommissionPercentage(vendorId);
  if (profileRate != null) {
    return { rate: profileRate, source: 'vendor_commission_percentage', monthlyRevenue };
  }

  return { rate: DEFAULT_COMMISSION_RATE, source: 'platform_default', monthlyRevenue };
}
