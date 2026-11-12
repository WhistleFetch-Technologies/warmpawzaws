import type { Context } from 'hono';
import { resolveCustomerIdFromPhone } from '../../../../utils/customer-coordinates';
import { dbFindCustomerLegalAcceptance } from '../repos/wpay-legal-acceptance.repo';
import { PLATFORM_CUSTOMER_LEGAL_VERSION } from '../shared/wpay-legal-acceptance';

export async function executeCustomerWarmpawzPayLegalAcceptanceGet(c: Context) {
  try {
    const phone = String(c.req.query('phone') ?? '').trim();
    if (!phone) {
      return c.json({ success: false, error: 'Phone is required' }, 400);
    }

    const customerId = await resolveCustomerIdFromPhone(phone);
    if (!customerId) {
      return c.json({ success: false, error: 'Customer not found' }, 404);
    }

    const policyVersion =
      String(c.req.query('policyVersion') ?? '').trim() || PLATFORM_CUSTOMER_LEGAL_VERSION;
    const row = await dbFindCustomerLegalAcceptance(customerId, policyVersion);

    return c.json({
      success: true,
      accepted: Boolean(row),
      policyVersion,
      acceptedAt: row?.accepted_at ?? null,
      source: row?.source ?? null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load legal acceptance';
    console.error('[customer/warmpawz-pay/legal-acceptance GET]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
