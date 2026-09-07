'use client';

import React, { useEffect, useState } from 'react';
import { CachedImage } from '@/components/shared/CachedImage';

type DiscoveryProviderAvatarProps = {
  name: string;
  photo?: string;
  className?: string;
  fallbackClassName?: string;
};

/** List-card avatar — CachedImage signs S3 keys / expired URLs; letter fallback on miss. */
export function DiscoveryProviderAvatar({
  name,
  photo,
  className = 'w-12 h-12 rounded-full object-cover border-2 border-[#FF8C42]',
  fallbackClassName = 'w-12 h-12 bg-[#FF8C42] rounded-full flex items-center justify-center text-white font-bold text-lg',
}: DiscoveryProviderAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [photo]);

  const initial = (name || 'P').charAt(0).toUpperCase();
  const showPhoto = Boolean(photo?.trim()) && !failed;

  if (showPhoto) {
    return (
      <CachedImage
        src={photo}
        alt={name}
        className={className}
        onUnavailable={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      className={fallbackClassName}
      role="img"
      aria-label={`Avatar for ${name}`}
    >
      {initial}
    </div>
  );
}
