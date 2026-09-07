/**
 * Build display URLs for image keys (presign today; CloudFront when configured).
 * Never invents a signed URL for an object that is not in any upload bucket.
 */

import {
  presignS3GetForBucketKey,
  resolveUploadBucketForKey,
} from '../../endpoints/constants/helper';
import { presignS3GetUrlIfApplicable } from '../../utils/s3-media-presign';
import { buildPublicS3ObjectUrl } from '../../utils/s3-presign-upload';

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

const PRESIGN_TTL_SECONDS = 604800;

function httpsOrNull(url: string | null | undefined): string | null {
  if (!url) return null;
  const s = String(url).trim();
  return /^https?:\/\//i.test(s) ? s : null;
}

export async function urlForImageKey(key: string | null | undefined): Promise<string | null> {
  if (!key) return null;
  const trimmed = String(key).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed;

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return httpsOrNull((await presignS3GetUrlIfApplicable(trimmed)) ?? trimmed);
  }

  const objectKey = trimmed.replace(/^\/+/, '');
  const resolvedBucket = await resolveUploadBucketForKey(objectKey);
  if (!resolvedBucket) return null;

  const cdnDomain = (process.env.MEDIA_CDN_DOMAIN || '').trim().replace(/\/$/, '');
  if (cdnDomain) {
    return `https://${cdnDomain}/${objectKey}`;
  }

  const signed = await presignS3GetForBucketKey(resolvedBucket, objectKey, PRESIGN_TTL_SECONDS);
  if (signed) return signed;

  const stableUrl = buildPublicS3ObjectUrl(resolvedBucket, objectKey, AWS_REGION);
  return httpsOrNull(await presignS3GetUrlIfApplicable(stableUrl));
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
