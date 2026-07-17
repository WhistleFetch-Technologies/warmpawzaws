import { query, select, insert, update } from '../../../../database/rds-connection';

export async function dbCustomerSearchsuggestionsGet0() {
  return await query(
        `SELECT keyword, hub_slug
         FROM search_taxonomy_keywords
         WHERE is_active = true
         ORDER BY weight DESC
         LIMIT 20`,
        []
      );
}

