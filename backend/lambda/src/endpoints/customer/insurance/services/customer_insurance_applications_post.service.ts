import type { Context } from 'hono';
import { z } from 'zod';
import { isInsuranceFormTemplateRequired, isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { openApplicationBlocksAnother } from '../../../warmpawz-insurance/shared/customer-plans';
import {
  dbFindApplicationByBooking,
  dbFindOpenApplication,
  dbFirstCustomerPet,
  dbGetBooking,
  dbInsertApplication,
  dbPlanCompany,
  dbPromoteConsultationBooked,
  dbVendorDefaultPlan,
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

function isInsuranceCategory(category: string): boolean {
  const value = category.toLowerCase();
  return value === 'insurance' || value === 'pet_insurance';
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
  const existing = await dbFindApplicationByBooking(input.bookingId);
  if (existing) return String(existing.id || '') || null;

  const booking = await dbGetBooking(input.bookingId);
  if (!booking || String(booking.customer_id) !== input.customerId) {
    console.warn('[insurance] attach skipped: booking not found');
    return null;
  }

  const vendorId = String(booking.vendor_id || input.vendorId || '');
  let planId = input.planId || '';
  let petId = input.petId || (booking.pet_id ? String(booking.pet_id) : '');
  const defaultPlan = !planId ? await dbVendorDefaultPlan(vendorId) : null;
  if (!planId && defaultPlan) planId = String(defaultPlan.id);

  if (!isInsuranceCategory(input.category) && !input.planId && !defaultPlan) return null;
  if (!planId) {
    console.warn('[insurance] attach skipped: no published plan for vendor');
    return null;
  }
  if (!petId) {
    const pet = await dbFirstCustomerPet(input.customerId);
    if (pet) petId = String(pet.id);
  }

  const plan = await dbPlanCompany(planId);
  if (!plan || String(plan.status) !== 'published' || String(plan.company_status) !== 'active') {
    console.warn('[insurance] attach skipped: PLAN_NOT_AVAILABLE');
    return null;
  }

  try {
    const application = await dbInsertApplication({
      bookingId: input.bookingId,
      customerId: input.customerId,
      vendorId,
      companyId: String(plan.company_id),
      planId,
      petId: petId || null,
    });
    return String(application.id || '') || null;
  } catch (error) {
    const raced = await dbFindApplicationByBooking(input.bookingId);
    if (raced) return String(raced.id || '') || null;
    if (petId) {
      const open = await dbFindOpenApplication(petId, planId);
      if (open) return String(open.id || '') || null;
    }
    console.warn('[insurance] application was not created:', error);
    return null;
  }
}

export async function promoteInsuranceOnBookingComplete(bookingId: string): Promise<void> {
  if (!isWarmpawzInsuranceEnabled()) return;
  let application = await dbFindApplicationByBooking(bookingId);
  if (!application) {
    const booking = await dbGetBooking(bookingId);
    if (!booking) return;
    const blob = [
      booking.notes,
      booking.service_type,
      booking.service_category,
      booking.service_style,
    ]
      .map((value) => String(value || '').toLowerCase())
      .join(' ');
    const isTele = blob.includes('tele');
    const looksLikeInsurance = blob.includes('insurance');
    const vendorId = String(booking.vendor_id || '');
    const linkedPlan = !looksLikeInsurance && isTele ? await dbVendorDefaultPlan(vendorId) : null;
    if (!looksLikeInsurance && !linkedPlan) return;
    await attachInsuranceApplicationOnBooking({
      bookingId,
      customerId: String(booking.customer_id),
      vendorId,
      planId: '',
      petId: booking.pet_id ? String(booking.pet_id) : null,
      category: looksLikeInsurance ? 'insurance' : '',
    });
    application = await dbFindApplicationByBooking(bookingId);
  }
  if (!application || String(application.status) !== 'consultation_booked') return;
  await dbPromoteConsultationBooked(String(application.id));
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
