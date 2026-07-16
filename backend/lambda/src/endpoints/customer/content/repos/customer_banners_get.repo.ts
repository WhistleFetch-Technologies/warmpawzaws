import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerBannersGet0(bannerType, now, limit, customerState, customerCity, text, title, subtitle, image_url, cta_text, cta_link, type, display_order, metadata, start_date) {
  return await query(
        `SELECT 
          id,
          title,
          subtitle,
          image_url,
          cta_text,
          cta_link,
          type,
          display_order,
          metadata,
          start_date,
          end_date
        FROM banners
        WHERE is_active = true
        AND (
          $1::text = 'all'
          OR ($1::text = 'main' AND type IN ('main', 'home_top'))
          OR (type = $1::text)
        )
        AND (start_date IS NULL OR start_date <= $2)
        AND (end_date IS NULL OR end_date >= $2)
        AND (
          (target_state IS NULL AND target_city IS NULL)
          OR (
            $4::text <> ''
            AND target_state IS NOT NULL
            AND target_city IS NULL
            AND LOWER(target_state) = LOWER($4::text)
          )
          OR (
            $5::text <> ''
            AND target_city IS NOT NULL
            AND LOWER(target_city) = LOWER($5::text)
            AND (
              target_state IS NULL
              OR ($4::text <> '' AND LOWER(target_state) = LOWER($4::text))
            )
          )
        )
        ORDER BY display_order ASC, created_at DESC
        LIMIT $3`,
        [bannerType, now, limit, customerState, customerCity]
      );
}

