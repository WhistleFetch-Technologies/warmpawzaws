import type { Context } from 'hono';
import { z } from 'zod';
import {
  isPawsCoverageSelectionValid,
  validatePawsCoverageSelection,
  type CoverageSelection,
  type HealthDeclarations,
} from '@warmpawz/shared-types';
import {
  isInsuranceFormTemplateRequired,
  isWarmpawzInsuranceEnabled,
} from '../../../../lib/warmpawz-insurance-flags';
import { openApplicationBlocksAnother } from '../../../warmpawz-insurance/shared/customer-plans';
import {
  dbFindOpenApplication,
  dbGetCustomerPet,
  dbInsertSelfServeEnquiry,
  dbPickAnyLinkedVendorForCompany,
  dbPickReadyVendorForCompany,
  dbPlanCompany,
} from '../repos/customer-insurance.repo';

function disabled(c: Context): Response {
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
}

const coverageSchema = z.object({
  mainSection: z.enum(['comprehensive', 'make_your_own', 'third_party']),
  myoCovers: z.array(z.enum(['injury', 'illness', 'surgery'])).optional(),
  sumInsured: z.number().int().positive(),
  copayPercent: z.number().nullable(),
  addons: z.array(z.enum(['veterinary_consultation', 'trip_cancellation', 'funeral_expenses'])),
  tripCancellationSumInsured: z.number().int().positive().nullable().optional(),
});

const healthSchema = z.object({
  priorIllnessOrInjury: z.enum(['Yes', 'No']),
  priorVetDiagnosis: z.enum(['Yes', 'No']),
  ongoingMedicationOrTreatment: z.enum(['Yes', 'No']),
  otherMedicalDisclosure: z.string().max(2000).optional(),
});

const bodySchema = z.object({
  customerId: z.string().uuid(),
  petId: z.string().uuid(),
  planId: z.string().uuid(),
  coverageSelection: coverageSchema,
  healthDeclarations: healthSchema,
  ownerSnapshot: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

export async function executecustomerInsuranceEnquiriesPost(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) return disabled(c);
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await c.req.json());
  } catch (error) {
    return c.json({ success: false, error: { code: 'VALIDATION', message: 'Invalid enquiry payload', details: error } }, 400);
  }

  const coverage = body.coverageSelection as CoverageSelection;
  const issues = validatePawsCoverageSelection(coverage);
  if (!isPawsCoverageSelectionValid(coverage) || issues.length) {
    return c.json(
      {
        success: false,
        error: { code: 'COVERAGE_INVALID', message: issues[0]?.message || 'Invalid coverage selection', issues },
      },
      422,
    );
  }

  const health = body.healthDeclarations as HealthDeclarations;
  const pet = await dbGetCustomerPet(body.customerId, body.petId);
  if (!pet) {
    return c.json({ success: false, error: { code: 'PET_NOT_FOUND', message: 'Pet not found for this customer' } }, 404);
  }

  const plan = await dbPlanCompany(body.planId);
  if (!plan || String(plan.status) !== 'published' || String(plan.company_status) !== 'active') {
    return c.json({ success: false, error: { code: 'PLAN_NOT_AVAILABLE', message: 'Plan is not available' } }, 422);
  }

  const open = await dbFindOpenApplication(body.petId, body.planId);
  if (open && openApplicationBlocksAnother(String(open.status))) {
    return c.json(
      {
        success: false,
        error: {
          code: 'OPEN_APPLICATION',
          message: 'An open application already exists for this pet and plan',
          applicationId: String(open.id),
        },
      },
      409,
    );
  }

  const companyId = String(plan.company_id);
  const requireForm = isInsuranceFormTemplateRequired();
  let vendorId = await dbPickReadyVendorForCompany(companyId, requireForm);
  if (!vendorId) vendorId = await dbPickAnyLinkedVendorForCompany(companyId);
  if (!vendorId) {
    return c.json(
      {
        success: false,
        error: {
          code: 'NO_VENDOR',
          message: 'No insurance advisor is linked for this product yet. Please try Talk to an Insurance Expert.',
        },
      },
      422,
    );
  }

  const application = await dbInsertSelfServeEnquiry({
    customerId: body.customerId,
    vendorId,
    companyId,
    planId: body.planId,
    petId: body.petId,
    coverageSelection: {
      ...coverage,
      ownerSnapshot: body.ownerSnapshot || null,
    },
    healthDeclarations: health as unknown as Record<string, unknown>,
  });

  return c.json(
    {
      success: true,
      data: {
        applicationId: String(application.id),
        status: String(application.status),
        reference: `APP-${String(application.id).slice(0, 8).toUpperCase()}`,
        companyName: 'HDFC ERGO',
        productName: 'Paws N Claws Pet Insurance',
        quoteState: 'awaiting_insurer_quotation',
        paymentAllowed: false,
        message:
          'Application submitted. An authorised advisor will obtain the HDFC ERGO quotation. Payment is not collected until a quote is shared.',
      },
    },
    201,
  );
}
