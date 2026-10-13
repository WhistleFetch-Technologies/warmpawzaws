import type { Context } from 'hono';
import { z } from 'zod';
import { termsInForce } from '../../../warmpawz-insurance/admin/domain/commission';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { buildCommissionSnapshot, transitionBlockReason } from '../../../warmpawz-insurance/shared/lifecycle';
import { dbConfirmSnapshot, dbLinkTerms } from '../../../warmpawz-insurance/vendor/lifecycle.repo';
import { dbGetApplication } from '../repos/customer-insurance.repo';

const bodySchema = z.object({ customerId: z.string().uuid() });

function istToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

export async function executecustomerInsuranceApplicationsIdConfirmPolicyPost(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const input = bodySchema.parse(await c.req.json());
  const application = await dbGetApplication(c.req.param('id'));
  if (!application || String(application.customer_id) !== input.customerId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  }
  if (String(application.status) === 'policy_confirmed') {
    return c.json({ success: true, data: { status: 'policy_confirmed' } });
  }
  const blocked = transitionBlockReason(String(application.status), 'policy_confirmed');
  if (blocked) return c.json({ success: false, error: { code: 'INVALID_TRANSITION', message: blocked } }, 422);
  const termRows = await dbLinkTerms(String(application.vendor_id), String(application.company_id));
  const terms = termRows.map((term) => ({
    id: String(term.id),
    basis: term.basis as 'percent_of_premium',
    rate: Number(term.rate),
    vendorCommissionRate: term.vendor_commission_rate == null ? null : Number(term.vendor_commission_rate),
    gstRate: term.gst_rate == null ? Number.NaN : Number(term.gst_rate),
    effectiveFrom: term.effective_from instanceof Date ? term.effective_from.toISOString().slice(0, 10) : String(term.effective_from).slice(0, 10),
  }));
  const snapshot = buildCommissionSnapshot({
    terms: termsInForce(terms, istToday()),
    premium: Number(application.issued_premium),
    vendorCommissionAmount: application.vendor_commission_amount == null ? null : Number(application.vendor_commission_amount),
  });
  if ('error' in snapshot) {
    return c.json({ success: false, error: { code: 'GST_REQUIRED', message: snapshot.error } }, 422);
  }
  await dbConfirmSnapshot({
    applicationId: String(application.id),
    linkId: termRows[0]?.link_id ? String(termRows[0].link_id) : null,
    snapshot,
    confirmedBy: 'customer',
  });
  return c.json({ success: true, data: { status: 'policy_confirmed', snapshot } });
}
