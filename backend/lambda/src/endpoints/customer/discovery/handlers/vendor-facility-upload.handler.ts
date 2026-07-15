import type { Context } from 'hono';
import { executevendorFacilityUpload } from '../services/vendor-facility-upload.service';

/** HTTP adapter — delegates to service layer. */
export async function vendorFacilityUploadHandler(c: Context) {
  return executevendorFacilityUpload(c);
}
