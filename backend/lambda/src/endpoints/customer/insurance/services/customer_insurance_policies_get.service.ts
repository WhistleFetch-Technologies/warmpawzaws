import type { Context } from 'hono';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { isWarmpawzInsuranceEnabled } from '../../../../lib/warmpawz-insurance-flags';
import { s3BrowserUploadClient } from '../../../../utils/s3-presign-upload';
import { dbCustomerPolicies } from '../../../warmpawz-insurance/vendor/lifecycle.repo';

const BUCKET = process.env.S3_UPLOADS_BUCKET || process.env.S3_BUCKET_NAME || '';

export async function executecustomerInsurancePoliciesGet(c: Context) {
  if (!isWarmpawzInsuranceEnabled()) {
    return c.json({ success: false, error: { code: 'NOT_FOUND', message: 'Warmpawz Insurance is disabled' } }, 404);
  }
  const customerId = c.req.query('customerId') || '';
  if (!customerId) return c.json({ success: false, error: { code: 'CUSTOMER_REQUIRED', message: 'customerId is required' } }, 400);
  const rows = await dbCustomerPolicies(customerId);
  const policies = await Promise.all(rows.map(async (row) => {
    const documents = Array.isArray(row.documents) ? row.documents : [];
    const signed = BUCKET
      ? await Promise.all(documents.map(async (doc) => {
          const key = String((doc as { s3Key?: string }).s3Key || '');
          if (!key) return doc;
          const url = await getSignedUrl(s3BrowserUploadClient, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn: 3600 });
          return { ...(doc as object), url };
        }))
      : documents;
    return { ...row, documents: signed };
  }));
  return c.json({ success: true, data: { policies } });
}
