import type { Context } from 'hono';
import { INSURANCE_STATUS_LABELS, normalizeInsuranceStatus } from '@warmpawz/shared-types';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { dbGetApplicationForCustomer } from '../repos/customer-insurance.repo';

function disabled(c: Context): Response {
  return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
}

function quoteStateForStatus(status: string, quotedPremium: number | null): string {
  if (status === 'enquiry_submitted') return 'awaiting_insurer_quotation';
  if (status === 'quote_shared' && quotedPremium != null) return 'quote_received';
  if (status === 'payment_link_sent') return 'purchase_assistance';
  if (status === 'policy_confirmed' || status === 'policy_uploaded') return 'policy_review';
  return status;
}

export async function executecustomerInsuranceApplicationsIdGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) return disabled(c);
  const applicationId = c.req.param('id');
  const customerId = c.req.query('customerId') || '';
  if (!applicationId || !customerId) {
    return c.json({ success: false, error: { code: 'VALIDATION', message: 'application id and customerId are required' } }, 400);
  }
  const row = await dbGetApplicationForCustomer(applicationId, customerId);
  if (!row) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  }
  const status = normalizeInsuranceStatus(String(row.status)) || String(row.status);
  const quoted =
    row.quoted_premium != null && Number.isFinite(Number(row.quoted_premium))
      ? Number(row.quoted_premium)
      : null;
  const paymentAllowed = status === 'payment_link_sent' || status === 'payment_link_expired';
  return c.json({
    success: true,
    data: {
      applicationId: String(row.id),
      reference: `APP-${String(row.id).slice(0, 8).toUpperCase()}`,
      status,
      statusLabel: INSURANCE_STATUS_LABELS[status as keyof typeof INSURANCE_STATUS_LABELS] || status,
      companyName: String(row.company_name || 'HDFC ERGO'),
      providerCode: row.provider_code ? String(row.provider_code) : 'HDFC_ERGO',
      planName: String(row.plan_name || 'Paws N Claws Pet Insurance'),
      petName: row.pet_name ? String(row.pet_name) : null,
      petSpecies: row.pet_species ? String(row.pet_species) : null,
      petBreed: row.pet_breed ? String(row.pet_breed) : null,
      coverageSelection: row.coverage_selection || {},
      healthDeclarations: row.health_declarations || {},
      applicationSource: String(row.application_source || 'consultation'),
      quotedPremium: quoted,
      quotedPremiumIllustrativeOnly: false,
      quoteState: quoteStateForStatus(status, quoted),
      paymentAllowed,
      premiumNote:
        quoted == null
          ? 'Awaiting insurer quotation. No payment is due until an authorised quote is shared.'
          : 'Quoted premium was entered by an authorised advisor after HDFC ERGO confirmation.',
    },
  });
}
