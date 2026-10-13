import type { Context } from 'hono';
import { isInsuranceFormTemplateRequired, isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { isCustomerVisiblePlan } from '../../../warmpawz-insurance/shared/customer-plans';
import { dbGetCustomerPlan } from '../repos/customer-insurance.repo';
import { mapCustomerPlan } from './customer_insurance_plans_get.service';

export async function executecustomerInsurancePlansIdGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const plan = await dbGetCustomerPlan(c.req.param('id'), isInsuranceFormTemplateRequired());
  if (!plan) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  const mapped = mapCustomerPlan({ ...plan, ready_vendor_count: Array.isArray(plan.vendors) ? plan.vendors.length : 0 });
  if (
    !isCustomerVisiblePlan({
      id: mapped.id,
      status: mapped.status,
      companyActive: mapped.companyActive,
      readyVendorCount: mapped.readyVendorCount,
    })
  ) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  }
  const vendors = (Array.isArray(plan.vendors) ? plan.vendors : []).map((row) => {
    const vendor = row as Record<string, unknown>;
    return {
      vendorId: String(vendor.vendor_id),
      name: String(vendor.vendor_name || 'Insurance advisor'),
      rating: null,
      nextTeleSlot: null,
      teleAvailable: true,
    };
  });
  return c.json({
    success: true,
    data: {
      plan: mapped,
      vendors,
      coverOptions: plan.cover_options || [],
      sumInsuredOptions: plan.sum_insured_options || [],
      copayOptions: plan.copay_options || [],
    },
  });
}
