/**
 * Browser-compatible S3 presigned PUT URLs.
 * Default @aws-sdk/client-s3 adds flexible checksum query params that break fetch/XHR uploads.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

/** Disable automatic CRC32 on presigned PUT so browsers can upload with Content-Type only. */
export const s3BrowserUploadClient = new S3Client({
  region: AWS_REGION,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export function buildPublicS3ObjectUrl(bucket: string, key: string, region = AWS_REGION): string {
  const encodedKey = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}`;
}

export async function createPresignedCategoryStyleUploadUrls(opts: {
  bucket: string;
  key: string;
  contentType: string;
  putExpiresIn?: number;
  getExpiresIn?: number;
}): Promise<{
  uploadUrl: string;
  fileUrl: string;
  publicUrl: string;
  fileKey: string;
}> {
  const { bucket, key, contentType, putExpiresIn = 300, getExpiresIn = 604800 } = opts;

  const uploadUrl = await getSignedUrl(
    s3BrowserUploadClient,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: putExpiresIn }
  );

  const fileUrl = await getSignedUrl(
    s3BrowserUploadClient,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    }),
    { expiresIn: getExpiresIn }
  );

  return {
    uploadUrl,
    fileUrl,
    publicUrl: buildPublicS3ObjectUrl(bucket, key),
    fileKey: key,
  };
}
