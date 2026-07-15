import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerAnnouncementsGet0() {
  return await query(
        `SELECT setting_value FROM platform_settings WHERE setting_key = 'home_announcements'`
      )
}

