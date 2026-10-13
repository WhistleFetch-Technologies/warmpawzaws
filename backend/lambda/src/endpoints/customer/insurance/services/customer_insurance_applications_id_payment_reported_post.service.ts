import type { Context } from 'hono';
import { z } from 'zod';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { transitionBlockReason } from '../../../warmpawz-insurance/shared/lifecycle';
import { dbSetStatus } from '../../../warmpawz-insurance/vendor/lifecycle.repo';
import { dbGetApplication } from '../repos/customer-insurance.repo';

const bodySchema = z.object({ customerId: z.string().uuid() });

export async function executecustomerInsuranceApplicationsIdPaymentReportedPost(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const input = bodySchema.parse(await c.req.json());
  const application = await dbGetApplication(c.req.param('id'));
  if (!application || String(application.customer_id) !== input.customerId) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Application not found' } }, 404);
  }
  const blocked = transitionBlockReason(String(application.status), 'payment_reported');
  if (blocked) return c.json({ success: false, error: { code: 'INVALID_TRANSITION', message: blocked } }, 422);
  await dbSetStatus(String(application.id), 'payment_reported', 'payment_link_sent', 'customer', 'Customer reported payment');
  return c.json({ success: true, data: { status: 'payment_reported' } });
}
