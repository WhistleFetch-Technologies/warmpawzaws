import type { Context } from 'hono';
import { isInsuranceFormTemplateRequired, isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { isCustomerVisiblePlan } from '../../../warmpawz-insurance/shared/customer-plans';
import { nextTeleSlotLabel, type TeleWindow } from '../../../warmpawz-insurance/shared/next-tele-slot';
import { dbGetCustomerPlan } from '../repos/customer-insurance.repo';
import { mapCustomerPlan } from './customer_insurance_plans_get.service';

function groupVendors(rows: unknown[], now: Date) {
  const grouped = new Map<string, { vendorId: string; name: string; windows: TeleWindow[] }>();
  for (const row of rows) {
    const vendor = row as Record<string, unknown>;
    const vendorId = String(vendor.vendor_id || '');
    if (!vendorId) continue;
    const current = grouped.get(vendorId) ?? {
      vendorId,
      name: String(vendor.vendor_name || 'Insurance advisor'),
      windows: [],
    };
    if (vendor.day_of_week != null && vendor.start_time) {
      current.windows.push({ dayOfWeek: Number(vendor.day_of_week), startTime: String(vendor.start_time) });
    }
    grouped.set(vendorId, current);
  }
  return [...grouped.values()].map((vendor) => ({
    vendorId: vendor.vendorId,
    name: vendor.name,
    rating: null,
    nextTeleSlot: nextTeleSlotLabel(vendor.windows, now),
    teleAvailable: true,
  }));
}

export async function executecustomerInsurancePlansIdGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const plan = await dbGetCustomerPlan(c.req.param('id'), isInsuranceFormTemplateRequired());
  if (!plan) return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Plan not found' } }, 404);
  const vendors = groupVendors(Array.isArray(plan.vendors) ? plan.vendors : [], new Date());
  const mapped = mapCustomerPlan({ ...plan, ready_vendor_count: vendors.length });
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
