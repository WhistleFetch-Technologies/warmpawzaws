import type { Context } from 'hono';
import { resolveWpayAuthenticatedCustomer } from '../shared/wpay-authenticated-customer';
import { dbUpsertCustomerLegalAcceptance } from '../repos/wpay-legal-acceptance.repo';
import {
  PLATFORM_CUSTOMER_LEGAL_VERSION,
  WPAY_LEGAL_ACCEPTANCE_SOURCE,
} from '../shared/wpay-legal-acceptance';

export async function executeCustomerWarmpawzPayLegalAcceptancePost(c: Context) {
  try {
    const body = await c.req.json().catch(() => ({}));
    const phone = String((body as { phone?: string })?.phone ?? '').trim();
    const auth = await resolveWpayAuthenticatedCustomer(c, phone);
    if (!auth.ok) {
      return c.json({ success: false, error: auth.error }, auth.status);
    }

    const policyVersion =
      String((body as { policyVersion?: string })?.policyVersion ?? '').trim() ||
      PLATFORM_CUSTOMER_LEGAL_VERSION;
    const source =
      String((body as { source?: string })?.source ?? '').trim() || WPAY_LEGAL_ACCEPTANCE_SOURCE;

    const ipAddress =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
      c.req.header('x-real-ip') ||
      null;
    const userAgent = c.req.header('user-agent') || null;

    const row = await dbUpsertCustomerLegalAcceptance({
      customerId: auth.customerId,
      policyVersion,
      source,
      ipAddress,
      userAgent,
    });

    return c.json({
      success: true,
      accepted: true,
      policyVersion: row.policy_version,
      acceptedAt: row.accepted_at,
      source: row.source,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to record legal acceptance';
    console.error('[customer/warmpawz-pay/legal-acceptance POST]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
