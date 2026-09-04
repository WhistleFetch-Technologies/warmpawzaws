'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import {
  fetchAndCacheImageSrc,
  getCachedImageBlobUrl,
  isIndexedDbCacheableImageSrc,
  isManagedVendorMediaKey,
  isRefreshableManagedImageSrc,
} from '@/lib/image-asset-cache';
import { fullImageUrlFromThumbSrc, isDerivedThumbImageSrc } from '@/lib/full-image-url-from-thumb';

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
  onLoad?: React.ReactEventHandler<HTMLImageElement>;
};

async function refreshSignedUrlIfNeeded(url: string): Promise<string | null> {
  if (!isRefreshableManagedImageSrc(url)) return null;
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

export function fillImageStyle(
  fill: boolean,
  style?: React.CSSProperties,
): React.CSSProperties | undefined {
  if (!fill) return style;
  return {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    ...style,
  };
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
  if (isDerivedThumbImageSrc(raw)) return;
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
  onLoad,
}: CachedImageProps) {
  const [displaySrc, setDisplaySrc] = useState<string>(src?.trim() || '');
  const [failed, setFailed] = useState(false);
  const [triedThumbSibling, setTriedThumbSibling] = useState(false);
  const [triedRefresh, setTriedRefresh] = useState(false);

  const cacheable = isIndexedDbCacheableImageSrc(src);
  const resolvedClassName = classNameForFill(fill, className);
  const onUnavailableRef = useRef(onUnavailable);
  onUnavailableRef.current = onUnavailable;

  useEffect(() => {
    const raw = src?.trim() || '';
    setFailed(false);
    setTriedRefresh(false);
    setTriedThumbSibling(false);
    if (!raw) {
      setDisplaySrc('');
      return;
    }

    let cancelled = false;

    if (isManagedVendorMediaKey(raw)) {
      setDisplaySrc('');
      void (async () => {
        const signed = await refreshSignedUrlIfNeeded(raw);
        if (cancelled) return;
        if (signed) {
          setDisplaySrc(signed);
          return;
        }
        setFailed(true);
        onUnavailableRef.current?.();
      })();
      return () => {
        cancelled = true;
      };
    }

    // Always paint the normal URL first (parity with previous next/image / <img>).
    setDisplaySrc(raw);

    if (!isIndexedDbCacheableImageSrc(raw)) {
      return;
    }

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

    if (!triedThumbSibling) {
      const sibling = fullImageUrlFromThumbSrc(raw) || fullImageUrlFromThumbSrc(displaySrc);
      if (sibling && sibling !== raw && sibling !== displaySrc) {
        setTriedThumbSibling(true);
        setDisplaySrc(sibling);
        return;
      }
    }

    if (!triedRefresh && isRefreshableManagedImageSrc(raw)) {
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
  }, [src, triedRefresh, triedThumbSibling, displaySrc, markUnavailable]);

  if (!src?.trim() || failed) return null;

  const imgStyle = fillImageStyle(fill, style);

  if (!displaySrc && isManagedVendorMediaKey(src)) {
    return fill ? <div className="absolute inset-0" aria-hidden /> : null;
  }

  if (!cacheable) {
    const external = (displaySrc || src || '').trim();
    if (!external) return null;
    return (
      <img
        src={external}
        alt={alt}
        className={resolvedClassName}
        style={imgStyle}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        loading={loading}
        decoding="async"
        onLoad={onLoad}
        onError={() => {
          void handleError();
        }}
      />
    );
  }

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
      onLoad={onLoad}
      onError={() => {
        void handleError();
      }}
    />
  );
}
