import { query } from '../../../../database/rds-connection';
import { wpayCatalogueCustomerVisibleSql } from '../../../warmpawz-pay/shared/merchant/merchant-eligibility-sql';
import type { WpayVendorListDbRow } from './wpay-vendors-list.repo';

const CATALOGUE_TABLE = 'warmpawz_pay_vendor_catalog';
const PRICING_TABLE = 'warmpawz_pay_merchant_pricing';

export async function dbWpayVendorById(vendorId: string): Promise<WpayVendorListDbRow | null> {
  const sql = `
    SELECT
      c.id AS catalogue_id,
      c.vendor_id,
      v.business_name,
      v.owner_name,
      v.address,
      v.city,
      v.phone,
      v.vendor_type,
      v.metadata,
      v.profile_photo_url,
      r.customer_service,
      COALESCE(
        NULLIF(TRIM(r.config->>'category'), ''),
        NULLIF(TRIM(r.config->>'service_category'), ''),
        NULLIF(TRIM(r.config->>'serviceCategory'), ''),
        NULLIF(TRIM(r.role_type), '')
      ) AS role_category,
      r.config AS role_config,
      v.category AS legacy_category,
      r.name AS role_name,
      r.display_name AS role_display_name,
      p.discount_value AS pricing_discount_value,
      p.status AS pricing_status,
      p.effective_from AS pricing_effective_from,
      p.effective_until AS pricing_effective_until
    FROM ${CATALOGUE_TABLE} c
    INNER JOIN vendors v ON v.id = c.vendor_id
    LEFT JOIN roles r ON r.id = v.role_id
    LEFT JOIN ${PRICING_TABLE} p ON p.vendor_id = c.vendor_id
    WHERE c.vendor_id = $1
      AND (v.is_deleted IS NOT TRUE)
      AND ${wpayCatalogueCustomerVisibleSql('c')}
    LIMIT 1
  `;

  const result = await query(sql, [vendorId]);
  return (result.rows[0] as WpayVendorListDbRow | undefined) ?? null;
}
