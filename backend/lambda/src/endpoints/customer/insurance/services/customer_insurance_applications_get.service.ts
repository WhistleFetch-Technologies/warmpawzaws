import type { Context } from 'hono';
import { INSURANCE_STATUS_LABELS, normalizeInsuranceStatus } from '@warmpawz/shared-types';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { dbListApplicationsForCustomer } from '../repos/customer-insurance.repo';

function coverageSummary(selection: unknown): {
  mainSection: string | null;
  sumInsured: number | null;
  copayPercent: number | null;
} {
  if (!selection || typeof selection !== 'object') {
    return { mainSection: null, sumInsured: null, copayPercent: null };
  }
  const row = selection as Record<string, unknown>;
  const sum = row.sumInsured != null ? Number(row.sumInsured) : null;
  const copay = row.copayPercent != null ? Number(row.copayPercent) : null;
  return {
    mainSection: row.mainSection ? String(row.mainSection) : null,
    sumInsured: sum != null && Number.isFinite(sum) ? sum : null,
    copayPercent: copay != null && Number.isFinite(copay) ? copay : null,
  };
}

function progressStep(status: string): 1 | 2 | 3 | 4 {
  if (status === 'enquiry_submitted') return 1;
  if (
    status === 'consultation_booked' ||
    status === 'consulted' ||
    status === 'form_sent' ||
    status === 'form_submitted' ||
    status === 'changes_requested' ||
    status === 'form_confirmed'
  ) {
    return 2;
  }
  if (status === 'quote_shared') return 3;
  if (
    status === 'payment_link_sent' ||
    status === 'payment_link_expired' ||
    status === 'payment_reported'
  ) {
    return 4;
  }
  return 1;
}

export async function executecustomerInsuranceApplicationsGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const customerId = c.req.query('customerId') || '';
  if (!customerId) {
    return c.json({ success: false, error: { code: 'CUSTOMER_REQUIRED', message: 'customerId is required' } }, 400);
  }

  const rows = await dbListApplicationsForCustomer(customerId);
  const applications = rows.map((row) => {
    const status = normalizeInsuranceStatus(String(row.status)) || String(row.status);
    const coverage = coverageSummary(row.coverage_selection);
    const quoted =
      row.quoted_premium != null && Number.isFinite(Number(row.quoted_premium))
        ? Number(row.quoted_premium)
        : null;
    return {
      applicationId: String(row.id),
      reference: `APP-${String(row.id).slice(0, 8).toUpperCase()}`,
      status,
      statusLabel: INSURANCE_STATUS_LABELS[status as keyof typeof INSURANCE_STATUS_LABELS] || status,
      progressStep: progressStep(status),
      companyName: String(row.company_name || 'HDFC ERGO'),
      providerCode: row.provider_code ? String(row.provider_code) : 'HDFC_ERGO',
      planName: String(row.plan_name || 'Paws N Claws Pet Insurance'),
      petName: row.pet_name ? String(row.pet_name) : null,
      petSpecies: row.pet_species ? String(row.pet_species) : null,
      petBreed: row.pet_breed ? String(row.pet_breed) : null,
      applicationSource: String(row.application_source || 'consultation'),
      coverageSelection: coverage,
      quotedPremium: quoted,
      /** Never treat list payload as a pay-now offer. */
      paymentLinkAvailable: false,
      premiumNote:
        quoted == null
          ? 'Official premium is confirmed by HDFC ERGO. Payment is only requested after you accept an insurer quotation.'
          : 'An authorised advisor entered this premium after HDFC ERGO confirmation. Purchase assistance follows separately.',
      createdAt: row.created_at ? String(row.created_at) : null,
      updatedAt: row.updated_at ? String(row.updated_at) : null,
    };
  });

  return c.json({ success: true, data: { applications } });
}
