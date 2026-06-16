/**
 * Admin referral program settings and signup monitoring
 */

import { Hono } from 'hono';
import { query } from '../../../database/rds-connection';
import {
  getReferralProgramSettings,
  type ReferralProgramSettings,
} from '../../../lib/services/referral-program-settings';

export function registerAdminReferralsEndpoints(app: Hono) {
  /**
   * GET /admin/referral-program-settings
   */
  app.get('/admin/referral-program-settings', async (c) => {
    try {
      const settings = await getReferralProgramSettings();
      return c.json({ success: true, settings });
    } catch (error: unknown) {
      console.error('Error fetching referral program settings:', error);
      return c.json({ error: (error as Error).message || 'Failed to fetch settings' }, 500);
    }
  });

  /**
   * PUT /admin/referral-program-settings
   */
  app.put('/admin/referral-program-settings', async (c) => {
    try {
      const body = await c.req.json();
      const settings = await getReferralProgramSettings();

      const next: ReferralProgramSettings = {
        ...settings,
        is_enabled: body.is_enabled !== undefined ? Boolean(body.is_enabled) : settings.is_enabled,
        max_redemptions_per_code:
          body.max_redemptions_per_code === null || body.max_redemptions_per_code === ''
            ? null
            : body.max_redemptions_per_code !== undefined
              ? Number(body.max_redemptions_per_code)
              : settings.max_redemptions_per_code,
        minimum_booking_amount:
          body.minimum_booking_amount === null || body.minimum_booking_amount === ''
            ? null
            : body.minimum_booking_amount !== undefined
              ? Number(body.minimum_booking_amount)
              : settings.minimum_booking_amount,
        referrer_action_name:
          body.referrer_action_name?.trim() || settings.referrer_action_name,
        referee_action_name:
          body.referee_action_name?.trim() || settings.referee_action_name,
      };

      await query(
        `INSERT INTO referral_program_settings (
           id, is_enabled, max_redemptions_per_code, minimum_booking_amount,
           referrer_action_name, referee_action_name, updated_at
         ) VALUES ('default', $1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET
           is_enabled = EXCLUDED.is_enabled,
           max_redemptions_per_code = EXCLUDED.max_redemptions_per_code,
           minimum_booking_amount = EXCLUDED.minimum_booking_amount,
           referrer_action_name = EXCLUDED.referrer_action_name,
           referee_action_name = EXCLUDED.referee_action_name,
           updated_at = NOW()`,
        [
          next.is_enabled,
          next.max_redemptions_per_code,
          next.minimum_booking_amount,
          next.referrer_action_name,
          next.referee_action_name,
        ]
      );

      return c.json({ success: true, settings: next });
    } catch (error: unknown) {
      console.error('Error updating referral program settings:', error);
      return c.json({ error: (error as Error).message || 'Failed to update settings' }, 500);
    }
  });

  /**
   * GET /admin/referrals/stats
   */
  app.get('/admin/referrals/stats', async (c) => {
    try {
      const statsRes = await query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
           COUNT(*) FILTER (WHERE status = 'qualified')::int AS qualified,
           COUNT(*) FILTER (WHERE status = 'rewarded')::int AS rewarded,
           COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected,
           COUNT(*)::int AS total
         FROM referral_redemptions`
      );
      const pointsRes = await query(
        `SELECT COALESCE(SUM(lt.points), 0)::bigint AS total_points
         FROM loyalty_transactions lt
         WHERE lt.transaction_type = 'earned'
           AND lt.reference_type IN ('customer_referral', 'referral_signup')`
      );
      const row = statsRes.rows[0] || {};
      return c.json({
        success: true,
        stats: {
          pending: Number(row.pending || 0),
          qualified: Number(row.qualified || 0),
          rewarded: Number(row.rewarded || 0),
          rejected: Number(row.rejected || 0),
          total: Number(row.total || 0),
          totalPointsIssued: Number(pointsRes.rows[0]?.total_points || 0),
        },
      });
    } catch (error: unknown) {
      console.error('Error fetching referral stats:', error);
      return c.json({ error: (error as Error).message || 'Failed to fetch stats' }, 500);
    }
  });

  /**
   * GET /admin/referrals/signups
   */
  app.get('/admin/referrals/signups', async (c) => {
    try {
      const status = c.req.query('status')?.trim();
      const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);
      const offset = parseInt(c.req.query('offset') || '0', 10);

      const params: unknown[] = [];
      let where = 'WHERE 1=1';
      if (status) {
        params.push(status);
        where += ` AND rr.status = $${params.length}`;
      }
      params.push(limit);
      params.push(offset);

      const rows = await query(
        `SELECT
           rr.id,
           rr.status,
           rr.created_at,
           rr.qualified_at,
           rr.rewarded_at,
           r.referral_code,
           r.referrer_id,
           rr.referred_id,
           TRIM(COALESCE(ref.first_name, '') || ' ' || COALESCE(ref.last_name, '')) AS referrer_name,
           ref.phone AS referrer_phone,
           TRIM(COALESCE(ree.first_name, '') || ' ' || COALESCE(ree.last_name, '')) AS referee_name,
           ree.phone AS referee_phone
         FROM referral_redemptions rr
         INNER JOIN referrals r ON r.id = rr.referral_id
         LEFT JOIN customers ref ON ref.id = r.referrer_id
         LEFT JOIN customers ree ON ree.id = rr.referred_id
         ${where}
         ORDER BY rr.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
        params
      );

      return c.json({ success: true, signups: rows.rows, limit, offset });
    } catch (error: unknown) {
      console.error('Error fetching referral signups:', error);
      return c.json({ error: (error as Error).message || 'Failed to fetch signups' }, 500);
    }
  });
}
