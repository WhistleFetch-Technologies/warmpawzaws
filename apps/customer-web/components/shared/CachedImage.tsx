'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  fetchAndCacheImageSrc,
  getCachedImageBlobUrl,
  isIndexedDbCacheableImageSrc,
} from '@/lib/image-asset-cache';

type CachedImageProps = {
  src?: string | null;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
  width?: number;
  height?: number;
  fill?: boolean;
  sizes?: string;
  loading?: 'lazy' | 'eager';
  onUnavailable?: () => void;
};

async function refreshSignedUrlIfNeeded(url: string): Promise<string | null> {
  if (!url.includes('amazonaws.com')) return null;
  try {
    const data = await apiClient.get<{ success?: boolean; signedUrl?: string }>(
      `/storage/refresh-url?url=${encodeURIComponent(url)}`
    );
    if (data?.success && data.signedUrl) return data.signedUrl;
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Renders images with IndexedDB cache for static `/images/**` and managed S3/CDN keys.
 * Presigned URL expiry: refresh via API, then re-cache under the stable s3: key.
 */
export function CachedImage({
  src,
  alt,
  className,
  style,
  width,
  height,
  fill = false,
  sizes,
  loading = 'lazy',
  onUnavailable,
}: CachedImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string>(src?.trim() || '');
  const [failed, setFailed] = useState(false);
  const [triedRefresh, setTriedRefresh] = useState(false);

  const cacheable = isIndexedDbCacheableImageSrc(src);

  useEffect(() => {
    const raw = src?.trim() || '';
    setFailed(false);
    setTriedRefresh(false);
    if (!raw) {
      setDisplaySrc('');
      return;
    }

    if (!isIndexedDbCacheableImageSrc(raw)) {
      setDisplaySrc(raw);
      return;
    }

    let cancelled = false;

    (async () => {
      const cached = await getCachedImageBlobUrl(raw);
      if (cancelled) return;
      if (cached) {
        setDisplaySrc(cached);
        return;
      }
      const fetched = await fetchAndCacheImageSrc(raw);
      if (cancelled) return;
      if (fetched) {
        setDisplaySrc(fetched);
        return;
      }
      // CORS / network miss: still render original URL (img tag does not need CORS).
      setDisplaySrc(raw);
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  const markUnavailable = useCallback(() => {
    setFailed(true);
    onUnavailable?.();
  }, [onUnavailable]);

  const handleError = useCallback(async () => {
    const raw = src?.trim() || '';
    if (!raw) {
      markUnavailable();
      return;
    }

    if (!triedRefresh && raw.includes('amazonaws.com')) {
      setTriedRefresh(true);
      const refreshed = await refreshSignedUrlIfNeeded(raw);
      if (refreshed) {
        const cached = await fetchAndCacheImageSrc(refreshed);
        setDisplaySrc(cached || refreshed);
        return;
      }
    }

    // Blob stale/corrupt: fall back to network once.
    if (displaySrc.startsWith('blob:') && displaySrc !== raw) {
      setDisplaySrc(raw);
      return;
    }

    markUnavailable();
  }, [src, triedRefresh, displaySrc, markUnavailable]);

  if (!src?.trim() || failed) return null;

  if (!cacheable) {
    const external = (src || '').trim();
    return (
      <img
        src={external}
        alt={alt}
        className={className}
        style={style}
        width={width}
        height={height}
        loading={loading}
        decoding="async"
        onError={() => {
          setFailed(true);
          onUnavailable?.();
        }}
      />
    );
  }

  const imgStyle: React.CSSProperties = fill
    ? {
        ...style,
        objectFit: (style?.objectFit as React.CSSProperties['objectFit']) ?? 'cover',
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
      }
    : style ?? {};

  return (
    <img
      src={displaySrc || src}
      alt={alt}
      className={className}
      style={imgStyle}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      sizes={sizes}
      loading={loading}
      decoding="async"
      onError={() => {
        void handleError();
      }}
    />
  );
}
