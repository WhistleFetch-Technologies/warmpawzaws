/**
 * Presign S3 object URLs for browser display when the bucket is private.
 * Leaves non-S3 URLs, data URLs, and already-presigned URLs unchanged.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });

/**
 * If `url` points at S3 (virtual-hosted style), return a GET presigned URL.
 * Uses the bucket name from the URL so prod/staging buckets work even when env defaults differ.
 */
export async function presignS3GetUrlIfApplicable(
  url: string | null | undefined
): Promise<string | null | undefined> {
  if (url == null || url === '') return url;
  if (typeof url !== 'string') return url;
  if (url.startsWith('data:')) return url;
  if (url.includes('X-Amz-Algorithm=') || url.includes('X-Amz-Credential=')) return url;

  try {
    const u = new URL(url);
    const host = u.hostname;
    // e.g. my-bucket.s3.ap-south-1.amazonaws.com
    const match = host.match(/^([^.]+)\.s3[./]/);
    if (!match) return url;
    const bucket = match[1];

    const key = decodeURIComponent(u.pathname.replace(/^\//, ''));
    if (!key) return url;

    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 604800 }
    );
  } catch (e: any) {
    console.warn('[presignS3GetUrlIfApplicable] skipped:', e?.message || e);
    return url;
  }
}
