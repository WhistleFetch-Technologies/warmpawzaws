import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerFeaturedvendorsGet0(now, title, subtitle, image_url, cta_text, cta_link, role_id, service_category, metadata, display_order) {
  return await query(
        `SELECT id, title, subtitle, image_url, cta_text, cta_link, role_id, service_category, metadata, display_order, created_at
         FROM spotlight_offers
         WHERE is_active = true
         AND (start_date IS NULL OR start_date <= $1)
         AND (end_date IS NULL OR end_date >= $1)
         ORDER BY display_order ASC, created_at DESC`,
        [now]
      );
}

