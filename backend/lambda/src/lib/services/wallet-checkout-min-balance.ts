import type { PoolClient } from 'pg';

/** Platform KV: extra INR floor (max with loyalty-derived + table override). */
export const MIN_CUSTOMER_WALLET_BALANCE_PLATFORM_KEY = 'min_customer_wallet_balance_to_use_checkout_inr';

export class WalletCheckoutMinimumBalanceError extends Error {
  readonly code = 'WALLET_CHECKOUT_MIN_BALANCE' as const;

  constructor(
    public readonly requiredMinInr: number,
    public readonly currentBalance: number
  ) {
    super(
      `Wallet checkout requires a minimum balance of ₹${requiredMinInr.toFixed(2)} (current: ₹${currentBalance.toFixed(2)}).`
    );
    this.name = 'WalletCheckoutMinimumBalanceError';
  }
}

function roundMoney2(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function parseJsonbNumeric(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, v);
  if (typeof v === 'string') {
    const x = parseFloat(v);
    return Number.isFinite(x) ? Math.max(0, x) : 0;
  }
  if (typeof v === 'object' && v !== null && 'value' in (v as Record<string, unknown>)) {
    return parseJsonbNumeric((v as Record<string, unknown>).value);
  }
  return 0;
}

/**
 * INR minimum balance required before any booking wallet debit.
 * MAX( loyalty redeem equivalent, platform_settings floor, table override ) when enabled.
 * Loyalty part matches POST /loyalty/redeem: cash = round(min_redemption_points / redemption_rate, 2).
 */
export async function getEffectiveMinCustomerWalletBalanceForCheckout(
  client: PoolClient
): Promise<number> {
  type RulesRow = {
    enabled?: boolean;
    respect_loyalty_redeem_floor?: boolean;
    min_balance_inr_override?: string | number | null;
  };

  let rulesRow: RulesRow | null = null;
  let tableMissing = false;
  try {
    const r = await client.query<RulesRow>(
      `SELECT enabled, respect_loyalty_redeem_floor, min_balance_inr_override
       FROM wallet_checkout_rules
       WHERE is_active = true
       ORDER BY updated_at DESC NULLS LAST, created_at DESC
       LIMIT 1`
    );
    rulesRow = r.rows[0] ?? null;
  } catch (e: any) {
    if (e?.code === '42P01') {
      tableMissing = true;
      rulesRow = null;
    } else {
      throw e;
    }
  }

  if (tableMissing) {
    return 0;
  }

  if (!rulesRow) {
    return 0;
  }

  if (rulesRow.enabled === false) {
    return 0;
  }

  const respectLoyalty = rulesRow.respect_loyalty_redeem_floor !== false;

  let loyaltyFloor = 0;
  if (respectLoyalty) {
    try {
      const lr = await client.query<{ min_redemption_points?: string | null; redemption_rate?: string | null }>(
        `SELECT min_redemption_points::text, redemption_rate::text
         FROM loyalty_rules
         WHERE is_active = true`
      );
      const rows = lr.rows || [];
      if (rows.length === 1) {
        const minRp = parseInt(String(rows[0].min_redemption_points ?? ''), 10);
        const rr = parseFloat(String(rows[0].redemption_rate ?? ''));
        if (Number.isFinite(minRp) && minRp >= 1 && Number.isFinite(rr) && rr > 0) {
          loyaltyFloor = roundMoney2(minRp / rr);
        }
      }
    } catch {
      /* loyalty_rules missing or column drift */
    }
  }

  let platformFloor = 0;
  try {
    const ps = await client.query<{ setting_value: unknown }>(
      `SELECT setting_value FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
      [MIN_CUSTOMER_WALLET_BALANCE_PLATFORM_KEY]
    );
    const sv = ps.rows[0]?.setting_value;
    platformFloor = roundMoney2(parseJsonbNumeric(sv));
  } catch {
    /* */
  }

  let override = 0;
  if (rulesRow?.min_balance_inr_override != null && rulesRow.min_balance_inr_override !== '') {
    override = roundMoney2(parseFloat(String(rulesRow.min_balance_inr_override)));
    if (!Number.isFinite(override)) override = 0;
  }

  return roundMoney2(Math.max(loyaltyFloor, platformFloor, override));
}

export function assertCustomerWalletMeetsCheckoutMinimum(
  balanceBefore: number,
  requiredMinInr: number
): void {
  if (requiredMinInr <= 0) return;
  if (balanceBefore + 1e-9 < requiredMinInr) {
    throw new WalletCheckoutMinimumBalanceError(requiredMinInr, balanceBefore);
  }
}
