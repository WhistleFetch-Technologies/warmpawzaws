/**
 * Build display URLs for image keys (presign today; CloudFront when configured).
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  presignS3GetForBucketKey,
  resolveUploadBucketForKey,
} from '../../endpoints/constants/helper';
import { presignS3GetUrlIfApplicable } from '../../utils/s3-media-presign';
import { buildPublicS3ObjectUrl } from '../../utils/s3-presign-upload';
import { getUploadsBucket } from './image-repository';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const s3Client = new S3Client({ region: AWS_REGION });

const PRESIGN_TTL_SECONDS = 604800;

export async function urlForImageKey(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const trimmed = String(key).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed;
  if (trimmed.includes('X-Amz-Algorithm=')) return trimmed;

  const cdnDomain = (process.env.MEDIA_CDN_DOMAIN || '').trim().replace(/\/$/, '');
  if (cdnDomain) {
    const path = trimmed.replace(/^\/+/, '');
    return `https://${cdnDomain}/${path}`;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return (await presignS3GetUrlIfApplicable(trimmed)) ?? trimmed;
  }

  const objectKey = trimmed.replace(/^\/+/, '');
  const resolvedBucket = await resolveUploadBucketForKey(objectKey);
  const bucket = resolvedBucket ?? getUploadsBucket();
  if (resolvedBucket) {
    const signed = await presignS3GetForBucketKey(resolvedBucket, objectKey, PRESIGN_TTL_SECONDS);
    if (signed) return signed;
  }

  const stableUrl = buildPublicS3ObjectUrl(bucket, objectKey, AWS_REGION);
  return (
    (await presignS3GetUrlIfApplicable(stableUrl)) ??
    (await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      { expiresIn: PRESIGN_TTL_SECONDS },
    ))
  );
}

export async function attachUrlsToImageDto(dto: {
  imageKey: string;
  thumbKey: string | null;
  width: number;
  height: number;
  thumbWidth: number | null;
  thumbHeight: number | null;
  size: number;
  thumbSize: number | null;
  contentType: 'image/webp';
  dedupHit?: boolean;
}) {
  const [url, thumbUrl] = await Promise.all([
    urlForImageKey(dto.imageKey),
    dto.thumbKey ? urlForImageKey(dto.thumbKey) : Promise.resolve(null),
  ]);
  return {
    ...dto,
    url: url || '',
    thumbUrl,
  };
}
