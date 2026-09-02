'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { sanitizeDisplayImageUrl } from '@/lib/resolve-display-image-url';

type DiscoveryProviderAvatarProps = {
  name: string;
  photo?: string;
  className?: string;
  fallbackClassName?: string;
  /** When set, used instead of the name initial (e.g. Building2). */
  fallback?: ReactNode;
};

/** List-card avatar with onError fallback when presigned/thumb URL fails. */
export function DiscoveryProviderAvatar({
  name,
  photo,
  className = 'w-12 h-12 rounded-full object-cover border-2 border-[#FF8C42]',
  fallbackClassName = 'w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold text-lg',
  fallback,
}: DiscoveryProviderAvatarProps) {
  const [failed, setFailed] = useState(false);
  const safePhoto = sanitizeDisplayImageUrl(photo);

  useEffect(() => {
    setFailed(false);
  }, [photo]);

  const initial = (name || 'P').charAt(0).toUpperCase();

  if (safePhoto && !failed) {
    return (
      <img
        src={safePhoto}
        alt={name}
        className={className}
        onError={() => setFailed(true)}
      />
    );
  }

  return <div className={fallbackClassName}>{fallback ?? initial}</div>;
}
