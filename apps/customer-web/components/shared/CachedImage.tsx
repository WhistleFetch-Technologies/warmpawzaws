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
 * - IDB hit: paint blob only (no prior http request → no cancelled WebPs in DevTools).
 * - IDB miss: paint the normal URL once and never swap to blob on this mount; warm IDB idle.
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
  const [displaySrc, setDisplaySrc] = useState<string>('');
  const [ready, setReady] = useState(() => !isIndexedDbCacheableImageSrc(src));
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
      setReady(true);
      return;
    }

    if (!isIndexedDbCacheableImageSrc(raw)) {
      setDisplaySrc(raw);
      setReady(true);
      return;
    }

    let cancelled = false;
    setReady(false);
    setDisplaySrc('');

    (async () => {
      const cached = await getCachedImageBlobUrl(raw);
      if (cancelled) return;
      if (cached) {
        setDisplaySrc(cached);
        setReady(true);
        return;
      }
      // Miss: commit http src once — never swap to blob on this mount (avoids ERR_ABORTED).
      setDisplaySrc(raw);
      setReady(true);
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

  // Wait for IDB resolve so we don't paint http then abort when swapping to blob.
  if (!ready || !displaySrc) return null;

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
      src={displaySrc}
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
