'use client';

import { useCallback, useEffect, useState } from 'react';
import { PresignableImage } from '@/components/shared/PresignableImage';
import {
  fetchAndCacheImageSrc,
  getCachedImageBlobUrl,
  isStaticLocalImageSrc,
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

/**
 * Renders images with IndexedDB cache for same-origin static paths (/images/**).
 * S3 / presigned URLs delegate to PresignableImage (refresh on 403).
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

  const isStatic = isStaticLocalImageSrc(src);

  useEffect(() => {
    const raw = src?.trim() || '';
    setFailed(false);
    if (!raw) {
      setDisplaySrc('');
      return;
    }

    if (!isStaticLocalImageSrc(raw)) {
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
      } else {
        setDisplaySrc(raw);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src]);

  const handleStaticError = useCallback(() => {
    setFailed(true);
    onUnavailable?.();
  }, [onUnavailable]);

  if (!src?.trim() || failed) return null;

  if (!isStatic) {
    const external = (src || '').trim();
    if (!external.includes('amazonaws.com')) {
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
    return (
      <PresignableImage
        src={src}
        alt={alt}
        className={className}
        style={style}
        onUnavailable={onUnavailable}
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
      onError={handleStaticError}
    />
  );
}
