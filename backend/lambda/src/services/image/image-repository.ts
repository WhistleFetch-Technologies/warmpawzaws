/**
 * S3 operations for display images (immutable WebP cache headers).
 */

import {
  CopyObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { buildCleanupKey } from './image-key-builder';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const s3Client = new S3Client({ region: AWS_REGION });

export const IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export function getUploadsBucket(): string {
  return (
    process.env.S3_UPLOADS_BUCKET ||
    process.env.S3_BUCKET_NAME ||
    'warmpawz-dev-user-uploads-057442119249'
  );
}

export async function putWebpObject(
  key: string,
  body: Buffer,
  bucket: string = getUploadsBucket(),
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'image/webp',
      CacheControl: IMAGE_CACHE_CONTROL,
    }),
  );
}

export async function moveKeyToCleanup(
  previousKey: string,
  bucket: string = getUploadsBucket(),
): Promise<void> {
  const src = previousKey.replace(/^\/+/, '');
  if (!src || src.startsWith('cleanup/')) return;

  const dest = buildCleanupKey(src);
  try {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${src}`,
        Key: dest,
        CacheControl: IMAGE_CACHE_CONTROL,
        ContentType: 'image/webp',
        MetadataDirective: 'REPLACE',
      }),
    );
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: src,
      }),
    );
  } catch (err: unknown) {
    console.warn('[image-repository] moveKeyToCleanup failed:', (err as Error)?.message || err);
  }
}

export async function deleteObjectKey(key: string, bucket: string = getUploadsBucket()): Promise<void> {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key.replace(/^\/+/, ''),
      }),
    );
  } catch (err: unknown) {
    console.warn('[image-repository] deleteObjectKey failed:', (err as Error)?.message || err);
  }
}
