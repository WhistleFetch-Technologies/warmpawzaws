import type { Context } from 'hono';
import { dbWpayVendorById } from '../repos/wpay-vendor-detail.repo';
import { dbWpayVendorReviewStats } from '../repos/wpay-vendor-reviews.repo';
import { mapWpayVendorDetailRow } from './wpay-vendor-detail-mapper';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function executeCustomerWarmpawzPayVendorGet(c: Context) {
  const vendorId = c.req.param('vendorId')?.trim() ?? '';
  if (!UUID_RE.test(vendorId)) {
    return c.json({ success: false, error: 'Invalid vendor id' }, 400);
  }

  try {
    const row = await dbWpayVendorById(vendorId);
    if (!row) {
      return c.json({ success: false, error: 'Vendor not found' }, 404);
    }

    const reviews = await dbWpayVendorReviewStats(vendorId);
    const vendor = await mapWpayVendorDetailRow(row, reviews);
    return c.json({ success: true, vendor });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load vendor';
    console.error('[customer/warmpawz-pay/vendors/:vendorId]', error);
    return c.json({ success: false, error: message }, 500);
  }
}
