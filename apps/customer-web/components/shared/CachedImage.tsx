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

/** Match next/image fill default (cover) without overriding explicit Tailwind object-* classes. */
function classNameForFill(fill: boolean, className?: string): string | undefined {
  if (!fill) return className;
  if (className && /\bobject-(contain|cover|fill|none|scale-down)\b/.test(className)) {
    return className;
  }
  return className ? `${className} object-cover` : 'object-cover';
}

function scheduleIdleWarm(raw: string): void {
  if (typeof window === 'undefined') return;
  const warm = () => {
    void fetchAndCacheImageSrc(raw);
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(warm, { timeout: 6000 });
  } else {
    window.setTimeout(warm, 2500);
  }
}

/**
 * Renders images with IndexedDB cache for static `/images/**` and managed S3/CDN keys.
 *
 * First paint uses the normal URL (one network load via <img>). IndexedDB is warmed
 * idle in the background — we do not block or re-download solely to populate cache.
 * On later visits, IDB blob URLs serve without another network trip.
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
  const resolvedClassName = classNameForFill(fill, className);

  useEffect(() => {
    const raw = src?.trim() || '';
    setFailed(false);
    setTriedRefresh(false);
    if (!raw) {
      setDisplaySrc('');
      return;
    }

    // Always paint the normal URL first (parity with previous next/image / <img>).
    setDisplaySrc(raw);

    if (!isIndexedDbCacheableImageSrc(raw)) {
      return;
    }

    let cancelled = false;

    (async () => {
      const cached = await getCachedImageBlobUrl(raw);
      if (cancelled) return;
      if (cached) {
        // Instant repeat visit — swap to blob (no network).
        setDisplaySrc(cached);
        return;
      }
      // Miss: leave <img src=raw> to load once; warm IDB without a second display path.
      scheduleIdleWarm(raw);
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
        className={resolvedClassName}
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

  // Absolute fill layout only — object-fit comes from className / style (see classNameForFill).
  const imgStyle: React.CSSProperties = fill
    ? {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        ...style,
      }
    : style ?? {};

  return (
    <img
      src={displaySrc || src}
      alt={alt}
      className={resolvedClassName}
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
