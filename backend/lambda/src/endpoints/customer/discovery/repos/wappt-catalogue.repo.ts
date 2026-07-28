import { query } from '../../../../database/rds-connection';
import {
  WAPPT_CATALOGUE_PUBLISHED,
  WAPPT_CATALOGUE_TABLE,
} from '../constants/wappt-catalogue';

export async function dbIsVendorWapptCataloguePublished(vendorId: string): Promise<boolean> {
  const id = String(vendorId || '').trim();
  if (!id) return false;
  const res = await query(
    `SELECT 1
     FROM ${WAPPT_CATALOGUE_TABLE}
     WHERE vendor_id = $1::uuid AND publish_status = $2
     LIMIT 1`,
    [id, WAPPT_CATALOGUE_PUBLISHED],
  );
  return res.rows.length > 0;
}
