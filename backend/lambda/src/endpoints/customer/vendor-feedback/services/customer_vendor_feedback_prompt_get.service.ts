import type { Context } from 'hono';
import { getCustomerCoordinates } from '../../../../utils/customer-coordinates';
import { resolveCustomerIdFromHonoContext } from '../../../../utils/customer-id-from-auth';
import { dbLatestVendorFeedbackCandidate } from '../repos/vendor-feedback-prompt.repo';
import type { VendorFeedbackPromptResponse } from '../shared/vendor-feedback.types';
import { mapVendorFeedbackPrompt, type CustomerCoords } from './vendor-feedback-card-mapper';

const LOG = '[customer/vendor-feedback/prompt]';

function parseCoordinate(raw: string | undefined): number | null {
  if (raw == null || raw === '') return null;
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : null;
}

async function resolveCoords(c: Context, customerId: string): Promise<CustomerCoords | null> {
  const lat = parseCoordinate(c.req.query('lat') ?? c.req.query('latitude'));
  const lng = parseCoordinate(c.req.query('lng') ?? c.req.query('longitude'));
  if (lat != null && lng != null) return { latitude: lat, longitude: lng };
  try {
    return await getCustomerCoordinates(null, customerId);
  } catch (err) {
    console.warn(LOG, 'getCustomerCoordinates failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

export async function executeCustomerVendorFeedbackPromptGet(c: Context) {
  const customerId = await resolveCustomerIdFromHonoContext(c);
  if (!customerId) {
    return c.json({ success: false, error: 'Authentication required' }, 401);
  }

  try {
    const row = await dbLatestVendorFeedbackCandidate(customerId);
    if (!row || row.reviewed || row.dismissed) {
      const body: VendorFeedbackPromptResponse = { success: true, prompt: null };
      return c.json(body);
    }

    const coords = await resolveCoords(c, customerId);
    const body: VendorFeedbackPromptResponse = {
      success: true,
      prompt: await mapVendorFeedbackPrompt(row, coords),
    };
    return c.json(body);
  } catch (error: unknown) {
    // The prompt is optional UI on home; never surface a failure to the customer.
    console.error(LOG, error);
    const body: VendorFeedbackPromptResponse = { success: true, prompt: null };
    return c.json(body);
  }
}
