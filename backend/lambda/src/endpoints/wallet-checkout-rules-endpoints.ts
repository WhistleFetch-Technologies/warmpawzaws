/**
 * Admin: wallet checkout minimum balance (loyalty-aligned + platform KV).
 */

import { Hono } from 'hono';
import { query, select, update, upsert, withTransaction } from 'src/database/rds-connection';
import {
  getEffectiveMinCustomerWalletBalanceForCheckout,
  MIN_CUSTOMER_WALLET_BALANCE_PLATFORM_KEY,
} from 'src/lib/services/wallet-checkout-min-balance';
import { resolveMinRedemptionPointsFromRuleRow } from 'src/utils/loyalty-rule-fields';

function roundMoney2(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100) / 100;
}

function loyaltyRedeemFloorInrFromRows(rows: Array<Record<string, any>>): number {
  if (rows.length !== 1) return 0;
  const minRp = resolveMinRedemptionPointsFromRuleRow(rows[0]);
  const rr = parseFloat(String(rows[0].redemption_rate ?? ''));
  if (Number.isFinite(minRp) && minRp >= 1 && Number.isFinite(rr) && rr > 0) {
    return roundMoney2(minRp / rr);
  }
  return 0;
}

export function registerWalletCheckoutRulesEndpoints(app: Hono) {
  app.get('/admin/wallet-checkout-rules', async (c) => {
    try {
      const rulesRes = await query(`SELECT * FROM wallet_checkout_rules WHERE is_active = true ORDER BY updated_at DESC LIMIT 1`).catch(
        () => ({ rows: [] as any[] })
      );
      const rule = rulesRes.rows?.[0] || null;

      const lr = await query(`SELECT * FROM loyalty_rules WHERE is_active = true`).catch(() => ({
        rows: [] as any[],
      }));
      const loyaltyFloor = loyaltyRedeemFloorInrFromRows(lr.rows || []);

      const ps = await query(
        `SELECT id, setting_key, setting_value, setting_type, description FROM platform_settings WHERE setting_key = $1 LIMIT 1`,
        [MIN_CUSTOMER_WALLET_BALANCE_PLATFORM_KEY]
      ).catch(() => ({ rows: [] as any[] }));
      const platformRow = ps.rows?.[0] || null;

      let effectiveMinInr = 0;
      await withTransaction(async (client) => {
        effectiveMinInr = await getEffectiveMinCustomerWalletBalanceForCheckout(client);
      });

      return c.json({
        success: true,
        rule,
        loyaltyRedeemFloorInr: loyaltyFloor,
        activeLoyaltyRulesCount: (lr.rows || []).length,
        platformSetting: platformRow,
        effectiveMinInr,
      });
    } catch (error: any) {
      console.error('[admin/wallet-checkout-rules] GET failed:', error);
      return c.json({ success: false, error: error?.message || 'Failed to load wallet checkout rules' }, 500);
    }
  });

  /** Body: { "minInr": 100 } — upserts platform_settings JSON number for extra checkout floor. */
  app.put('/admin/wallet-checkout-rules/platform-floor-inr', async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const raw = body.minInr ?? body.min_inr ?? body.value;
      const minInr = roundMoney2(parseFloat(String(raw ?? '0')));
      if (!Number.isFinite(minInr) || minInr < 0) {
        return c.json({ success: false, error: 'minInr must be a non-negative number' }, 400);
      }

      await upsert(
        'platform_settings',
        {
          setting_key: MIN_CUSTOMER_WALLET_BALANCE_PLATFORM_KEY,
          setting_value: minInr,
          setting_type: 'number',
          description:
            'Minimum INR wallet balance to use wallet at checkout (MAX with loyalty redeem floor and table override).',
          is_public: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        'setting_key'
      );

      let effectiveMinInr = 0;
      await withTransaction(async (client) => {
        effectiveMinInr = await getEffectiveMinCustomerWalletBalanceForCheckout(client);
      });

      return c.json({
        success: true,
        setting_key: MIN_CUSTOMER_WALLET_BALANCE_PLATFORM_KEY,
        minInr,
        effectiveMinInr,
      });
    } catch (error: any) {
      console.error('[admin/wallet-checkout-rules/platform-floor-inr] failed:', error);
      return c.json({ success: false, error: error?.message || 'Update failed' }, 500);
    }
  });

  app.put('/admin/wallet-checkout-rules/:id', async (c) => {
    try {
      const { id } = c.req.param();
      const body = await c.req.json().catch(() => ({}));
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (body.enabled !== undefined) patch.enabled = Boolean(body.enabled);
      if (body.is_active !== undefined) patch.is_active = Boolean(body.is_active);
      if (body.respect_loyalty_redeem_floor !== undefined) {
        patch.respect_loyalty_redeem_floor = Boolean(body.respect_loyalty_redeem_floor);
      }
      if (body.min_balance_inr_override !== undefined) {
        if (body.min_balance_inr_override === null || body.min_balance_inr_override === '') {
          patch.min_balance_inr_override = null;
        } else {
          const v = roundMoney2(parseFloat(String(body.min_balance_inr_override)));
          patch.min_balance_inr_override = Number.isFinite(v) ? v : null;
        }
      }

      await update('wallet_checkout_rules', { id }, patch);
      const updated = await select('wallet_checkout_rules', { id });
      let effectiveMinInr = 0;
      await withTransaction(async (client) => {
        effectiveMinInr = await getEffectiveMinCustomerWalletBalanceForCheckout(client);
      });
      return c.json({ success: true, rule: updated[0], effectiveMinInr });
    } catch (error: any) {
      console.error('[admin/wallet-checkout-rules] PUT failed:', error);
      return c.json({ success: false, error: error?.message || 'Update failed' }, 500);
    }
  });
}
