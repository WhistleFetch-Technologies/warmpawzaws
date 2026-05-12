'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
};

/**
 * Renders an image; on load error, tries GET /storage/refresh-url for private S3 objects.
 */
export function PresignableImage({ src, alt, className }: Props) {
  const [current, setCurrent] = useState(src || '');
  const [triedRefresh, setTriedRefresh] = useState(false);

  useEffect(() => {
    setCurrent(src || '');
    setTriedRefresh(false);
  }, [src]);

  const onError = useCallback(async () => {
    const url = current || src || '';
    if (!url || triedRefresh) return;
    if (!url.includes('amazonaws.com')) return;

    setTriedRefresh(true);
    try {
      const data = await apiClient.get<{ success?: boolean; signedUrl?: string }>(
        `/storage/refresh-url?url=${encodeURIComponent(url)}`
      );
      if (data?.success && data.signedUrl) {
        setCurrent(data.signedUrl);
      }
    } catch {
      /* keep broken state */
    }
  }, [current, src, triedRefresh]);

  if (!current) return null;

  return <img src={current} alt={alt} className={className} onError={onError} />;
}
