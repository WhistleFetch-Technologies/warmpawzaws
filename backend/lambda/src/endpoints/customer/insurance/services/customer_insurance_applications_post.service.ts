import type { Context } from 'hono';
import { z } from 'zod';
import { isInsuranceFormTemplateRequired, isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { openApplicationBlocksAnother } from '../../../warmpawz-insurance/shared/customer-plans';
import {
  dbFindApplicationByBooking,
  dbFindOpenApplication,
  dbGetBooking,
  dbInsertApplication,
  dbPlanCompany,
  dbVendorReadyForPlan,
} from '../repos/customer-insurance.repo';

const bodySchema = z.object({
  bookingId: z.string().uuid(),
  planId: z.string().uuid(),
  petId: z.string().uuid(),
  customerId: z.string().uuid(),
});

export async function createInsuranceApplication(input: z.infer<typeof bodySchema>) {
  const existingBooking = await dbFindApplicationByBooking(input.bookingId);
  if (existingBooking) return { status: 200 as const, application: existingBooking };
  const open = await dbFindOpenApplication(input.petId, input.planId);
  if (open && openApplicationBlocksAnother(String(open.status))) {
    return { status: 409 as const, code: 'OPEN_APPLICATION', message: 'An open application already exists for this pet and plan' };
  }
  const booking = await dbGetBooking(input.bookingId);
  if (!booking || String(booking.customer_id) !== input.customerId) {
    return { status: 404 as const, code: 'NOT_FOUND', message: 'Booking not found' };
  }
  const plan = await dbPlanCompany(input.planId);
  if (!plan || String(plan.status) !== 'published' || String(plan.company_status) !== 'active') {
    return { status: 422 as const, code: 'PLAN_NOT_AVAILABLE', message: 'Plan is not available' };
  }
  const vendorId = String(booking.vendor_id || '');
  const ready = await dbVendorReadyForPlan(vendorId, input.planId, isInsuranceFormTemplateRequired());
  if (!ready) return { status: 422 as const, code: 'VENDOR_NOT_READY', message: 'Vendor is not ready for this plan' };
  const application = await dbInsertApplication({
    bookingId: input.bookingId,
    customerId: input.customerId,
    vendorId,
    companyId: String(plan.company_id),
    planId: input.planId,
    petId: input.petId,
  });
  return { status: 201 as const, application };
}

export async function attachInsuranceApplicationOnBooking(input: {
  bookingId: string;
  customerId: string;
  vendorId: string;
  planId: string;
  petId: string | null;
  category: string;
}): Promise<string | null> {
  if (!isWarmpawzInsuranceEnabled()) return null;
  const category = input.category.toLowerCase();
  if (category !== 'insurance' && category !== 'pet_insurance' && !input.planId) return null;
  if (!input.planId || !input.petId) return null;
  const result = await createInsuranceApplication({
    bookingId: input.bookingId,
    planId: input.planId,
    petId: input.petId,
    customerId: input.customerId,
  });
  if ('code' in result) {
    console.warn('[insurance] application was not created:', result.code, result.message);
    return null;
  }
  return String(result.application.id || '') || null;
}

export async function executecustomerInsuranceApplicationsPost(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const input = bodySchema.parse(await c.req.json());
  const result = await createInsuranceApplication(input);
  if ('code' in result) {
    return c.json({ success: false, error: { code: result.code, message: result.message } }, result.status);
  }
  return c.json({ success: true, data: { application: result.application } }, result.status);
}
