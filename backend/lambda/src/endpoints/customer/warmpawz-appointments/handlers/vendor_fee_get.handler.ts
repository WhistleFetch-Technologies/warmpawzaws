import type { Context } from 'hono';
import { executeVendorFeeGet } from '../services/vendor_fee_get.service';

export function vendorFeeGetHandler(c: Context) {
  return executeVendorFeeGet(c);
}
