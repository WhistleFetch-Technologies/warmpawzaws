import { query } from '../../database/rds-connection';

export interface ReferralProgramSettings {
  id: string;
  is_enabled: boolean;
  max_redemptions_per_code: number | null;
  minimum_booking_amount: number | null;
  referrer_action_name: string;
  referee_action_name: string;
}

const DEFAULT_SETTINGS: ReferralProgramSettings = {
  id: 'default',
  is_enabled: true,
  max_redemptions_per_code: null,
  minimum_booking_amount: null,
  referrer_action_name: 'customer_referral',
  referee_action_name: 'referral_signup',
};

export async function getReferralProgramSettings(): Promise<ReferralProgramSettings> {
  try {
    const res = await query(
      `SELECT id, is_enabled, max_redemptions_per_code, minimum_booking_amount,
              referrer_action_name, referee_action_name
       FROM referral_program_settings
       WHERE id = 'default'
       LIMIT 1`
    );
    if (res.rows.length > 0) {
      const row = res.rows[0] as ReferralProgramSettings;
      return {
        ...DEFAULT_SETTINGS,
        ...row,
        is_enabled: row.is_enabled !== false,
        referrer_action_name: row.referrer_action_name || DEFAULT_SETTINGS.referrer_action_name,
        referee_action_name: row.referee_action_name || DEFAULT_SETTINGS.referee_action_name,
      };
    }
  } catch (err: unknown) {
    const msg = String((err as { message?: string })?.message || err);
    if (!msg.includes('referral_program_settings')) {
      console.warn('[REFERRAL] getReferralProgramSettings fallback:', msg);
    }
  }
  return { ...DEFAULT_SETTINGS };
}
