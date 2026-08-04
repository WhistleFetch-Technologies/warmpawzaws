/**
 * Context-aware image resolution for GET handlers (list thumbs vs detail display).
 */

import type { AssetType, ImageDisplayContext } from './image-types';
import { isWebpKey } from './image-key-builder';
import { thumbKeyForDisplay } from './image-content-index';
import { ensureWebpFromLegacy, extractRawImageKey } from './image-migrator';
import type { ImagePersistTarget } from './image-migrator-persist';
import { persistMigratedImageKey } from './image-migrator-persist';
import { attachUrlsToImageDto, urlForImageKey } from './image-url-builder';
import { presignS3GetUrlIfApplicable } from '../../utils/s3-media-presign';

export type ResolvedImageDto = {
  imageKey: string;
  url: string;
  thumbUrl: string | null;
  /** URL to render for the requested context (thumb in list when available). */
  displayUrl: string;
  width: number;
  height: number;
  thumbWidth: number | null;
  thumbHeight: number | null;
};

export type ResolveImageOptions = {
  assetType: AssetType;
  ownerId: string;
  vendorId?: string;
  context: ImageDisplayContext;
  /** Lazy WebP migrate on read when key is legacy non-WebP managed S3 object. */
  migrate?: boolean;
  persist?: ImagePersistTarget | null;
};

function stripPresignQuery(url: string): string {
  try {
    const u = new URL(url);
    if (
      u.hostname.includes('.s3.') &&
      u.hostname.includes('amazonaws.com') &&
      (u.searchParams.has('X-Amz-Algorithm') || u.searchParams.has('X-Amz-Credential'))
    ) {
      u.search = '';
      return u.toString();
    }
  } catch {
    return url;
  }
  return url;
}

function pickDisplayUrl(
  context: ImageDisplayContext,
  url: string,
  thumbUrl: string | null,
): string {
  if (context === 'list' && thumbUrl) return thumbUrl;
  return url || thumbUrl || '';
}

async function resolveExternalUrl(raw: string): Promise<ResolvedImageDto | null> {
  const stripped = stripPresignQuery(raw);
  const url = (await urlForImageKey(stripped)) ?? stripped;
  if (!url) return null;
  return {
    imageKey: stripped,
    url,
    thumbUrl: null,
    displayUrl: url,
    width: 0,
    height: 0,
    thumbWidth: null,
    thumbHeight: null,
  };
}

export async function resolveImageForContext(
  raw: string | null | undefined,
  opts: ResolveImageOptions,
): Promise<ResolvedImageDto | null> {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('/')) {
    return {
      imageKey: trimmed,
      url: trimmed,
      thumbUrl: null,
      displayUrl: trimmed,
      width: 0,
      height: 0,
      thumbWidth: null,
      thumbHeight: null,
    };
  }

  const key = extractRawImageKey(trimmed);
  const isManagedKey = Boolean(key && !trimmed.startsWith('http'));
  const isManagedS3Url = Boolean(key && trimmed.includes('://'));

  if (!key && (trimmed.startsWith('http://') || trimmed.startsWith('https://'))) {
    return resolveExternalUrl(trimmed);
  }

  if (!key) return null;

  // Stored full S3 URL: presign using bucket embedded in the URL (not default getUploadsBucket).
  if (isManagedS3Url && opts.migrate === false) {
    const stripped = stripPresignQuery(trimmed);
    const presigned = await presignS3GetUrlIfApplicable(stripped);
    if (presigned) {
      const thumbKey = isWebpKey(key) ? thumbKeyForDisplay(key, null) : null;
      let thumbUrl: string | null = null;
      if (thumbKey) {
        thumbUrl = await urlForImageKey(thumbKey);
      }
      const displayUrl = pickDisplayUrl(opts.context, presigned, thumbUrl);
      return {
        imageKey: key,
        url: presigned,
        thumbUrl,
        displayUrl,
        width: 0,
        height: 0,
        thumbWidth: null,
        thumbHeight: null,
      };
    }
  }

  let imageKey = key;
  let dto = await attachUrlsToImageDto({
    imageKey,
    thumbKey: isWebpKey(imageKey) ? thumbKeyForDisplay(imageKey, null) : null,
    width: 0,
    height: 0,
    thumbWidth: null,
    thumbHeight: null,
    size: 0,
    thumbSize: null,
    contentType: 'image/webp',
  });

  if (!isWebpKey(imageKey) && opts.migrate !== false && (isManagedKey || isManagedS3Url)) {
    const migrated = await ensureWebpFromLegacy(trimmed, opts.assetType, opts.ownerId, opts.vendorId);
    if (migrated?.imageKey) {
      imageKey = migrated.imageKey;
      dto = migrated;
      if (opts.persist) {
        await persistMigratedImageKey(opts.persist, imageKey);
      }
    }
  }

  const displayUrl = pickDisplayUrl(opts.context, dto.url, dto.thumbUrl);
  return {
    imageKey: dto.imageKey,
    url: dto.url,
    thumbUrl: dto.thumbUrl,
    displayUrl,
    width: dto.width,
    height: dto.height,
    thumbWidth: dto.thumbWidth,
    thumbHeight: dto.thumbHeight,
  };
}

/** Resolve a bare S3 key or URL to a presigned/CDN URL without migration. */
export async function resolveBareImageUrl(
  raw: string | null | undefined,
  context: ImageDisplayContext = 'detail',
): Promise<string | null> {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:') || trimmed.startsWith('/')) return trimmed;

  const key = extractRawImageKey(trimmed);
  if (key && !trimmed.includes('://')) {
    if (context === 'list' && isWebpKey(key)) {
      const thumbKey = thumbKeyForDisplay(key, null);
      if (thumbKey) {
        const thumbUrl = await urlForImageKey(thumbKey);
        if (thumbUrl) return thumbUrl;
      }
    }
    return (await urlForImageKey(key)) ?? trimmed;
  }

  const stripped = stripPresignQuery(trimmed);
  return (await urlForImageKey(stripped)) ?? stripped;
}

export type EnrichedProductImage =
  | string
  | {
      key: string;
      url: string;
      thumbUrl: string | null;
      displayUrl: string;
      width: number;
      height: number;
    };

export async function enrichProductImageForContext(
  raw: unknown,
  opts: Omit<ResolveImageOptions, 'context'> & { context: ImageDisplayContext },
): Promise<EnrichedProductImage> {
  if (raw == null) return '';
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const nested =
      o.url ?? o.src ?? o.image_url ?? o.imageUrl ?? o.key ?? o.imageKey ?? '';
    return enrichProductImageForContext(nested, opts);
  }
  const s = String(raw).trim();
  if (!s) return '';

  const resolved = await resolveImageForContext(s, {
    ...opts,
    assetType: 'product',
    migrate: opts.migrate ?? false,
  });
  if (!resolved) return s;

  const key = extractRawImageKey(s);
  const isOurKey =
    Boolean(key) &&
    (key!.startsWith('products/') ||
      key!.startsWith('media/') ||
      isWebpKey(key) ||
      s.includes('.s3.'));

  if (!isOurKey) {
    return resolved.displayUrl;
  }

  return {
    key: resolved.imageKey,
    url: resolved.url,
    thumbUrl: resolved.thumbUrl,
    displayUrl: resolved.displayUrl,
    width: resolved.width,
    height: resolved.height,
  };
}
