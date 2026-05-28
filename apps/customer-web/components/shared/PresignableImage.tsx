'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  /** Called when the image cannot be displayed (including after S3 refresh attempt). */
  onUnavailable?: () => void;
};

/**
 * Renders an image; on load error, tries GET /storage/refresh-url for private S3 objects.
 */
export function PresignableImage({ src, alt, className, onUnavailable }: Props) {
  const [current, setCurrent] = useState(src || '');
  const [triedRefresh, setTriedRefresh] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    setCurrent(src || '');
    setTriedRefresh(false);
    setUnavailable(false);
  }, [src]);

  const markUnavailable = useCallback(() => {
    setUnavailable(true);
    onUnavailable?.();
  }, [onUnavailable]);

  const onError = useCallback(async () => {
    const url = current || src || '';
    if (!url) {
      markUnavailable();
      return;
    }
    if (triedRefresh) {
      markUnavailable();
      return;
    }
    if (!url.includes('amazonaws.com')) {
      markUnavailable();
      return;
    }
    if (url.includes('X-Amz-Algorithm=') || url.includes('X-Amz-Credential=')) {
      markUnavailable();
      return;
    }

    setTriedRefresh(true);
    try {
      const data = await apiClient.get<{ success?: boolean; signedUrl?: string }>(
        `/storage/refresh-url?url=${encodeURIComponent(url)}`
      );
      if (data?.success && data.signedUrl) {
        setCurrent(data.signedUrl);
      } else {
        markUnavailable();
      }
    } catch {
      markUnavailable();
    }
  }, [current, src, triedRefresh, markUnavailable]);

  if (!current || unavailable) return null;

  return (
    <img
      src={current}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={onError}
    />
  );
}
