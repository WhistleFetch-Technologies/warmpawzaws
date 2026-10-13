import { query } from '../../../../database/rds-connection';
import { vendorDisplayName, type Row } from './row-mappers';

export interface VendorReadinessFacts {
  readonly linkId: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly companyId: string;
  readonly onboardingApproved: boolean;
  readonly vendorActive: boolean;
  readonly linkActive: boolean;
  readonly teleAvailability: boolean;
  readonly publishedForm: boolean;
}

const APPROVED = new Set(['approved', 'active', 'live']);

export async function dbVendorReadinessFacts(
  companyId: string,
  requirePublishedForm: boolean,
): Promise<VendorReadinessFacts[]> {
  const formSql = requirePublishedForm
    ? `EXISTS (
         SELECT 1 FROM insurance_form_templates t
         WHERE t.vendor_id = v.id AND t.company_id = l.company_id AND t.status = 'published'
       )`
    : 'false';
  const res = await query(
    `SELECT l.id AS link_id, l.vendor_id, l.company_id, l.status AS link_status,
            v.business_name, v.owner_name, v.status AS vendor_status, v.is_active,
            EXISTS (
              SELECT 1 FROM vendor_availability_v2 va
              WHERE va.vendor_id = v.id
                AND 'tele' = ANY (COALESCE(va.service_styles, ARRAY[]::text[]))
            ) AS tele_availability,
            ${formSql} AS published_form
     FROM insurance_vendor_companies l
     JOIN vendors v ON v.id = l.vendor_id
     WHERE l.company_id = $1::uuid
     ORDER BY v.business_name ASC NULLS LAST`,
    [companyId],
  );
  return (res.rows as Row[]).map((r) => ({
    linkId: String(r.link_id),
    vendorId: String(r.vendor_id),
    vendorName: vendorDisplayName(r),
    companyId: String(r.company_id),
    onboardingApproved: APPROVED.has(String(r.vendor_status ?? '').toLowerCase()),
    vendorActive: r.is_active === true,
    linkActive: String(r.link_status) === 'active',
    teleAvailability: r.tele_availability === true,
    publishedForm: r.published_form === true,
  }));
}
