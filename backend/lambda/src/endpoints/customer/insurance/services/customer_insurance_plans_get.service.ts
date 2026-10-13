import type { Context } from 'hono';
import { isInsuranceFormTemplateRequired, isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { isCustomerVisiblePlan } from '../../../warmpawz-insurance/shared/customer-plans';
import { dbListCustomerPlans } from '../repos/customer-insurance.repo';

function disabled(c: Context): Response {
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
}

export function mapCustomerPlan(row: Record<string, unknown>) {
  const highlights = Array.isArray(row.highlights) ? row.highlights.slice(0, 3) : [];
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    companyName: String(row.company_name || ''),
    logoUrl: row.logo_url ? String(row.logo_url) : null,
    name: String(row.name),
    productType: String(row.product_type || ''),
    highlights,
    premiumFrom: Number(row.premium_from || 0),
    premiumUnit: row.premium_unit === 'year' ? 'year' : 'month',
    disclaimer: 'Premium is indicative. The insurer confirms the final premium.',
    readyVendorCount: Number(row.ready_vendor_count || 0),
    status: String(row.status),
    companyActive: String(row.company_status) === 'active',
  };
}

export async function executecustomerInsurancePlansGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) return disabled(c);
  const rows = await dbListCustomerPlans(isInsuranceFormTemplateRequired());
  const plans = rows.map(mapCustomerPlan).filter((plan) =>
    isCustomerVisiblePlan({
      id: plan.id,
      status: plan.status,
      companyActive: plan.companyActive,
      readyVendorCount: plan.readyVendorCount,
    }),
  );
  return c.json({ success: true, data: { plans } });
}
