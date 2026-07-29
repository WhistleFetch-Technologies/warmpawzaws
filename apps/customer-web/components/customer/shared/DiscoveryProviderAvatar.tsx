'use client';

import React, { useEffect, useState } from 'react';

type DiscoveryProviderAvatarProps = {
  name: string;
  photo?: string;
  className?: string;
  fallbackClassName?: string;
};

/** List-card avatar with onError fallback when presigned/thumb URL fails. */
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

  if (photo && !failed) {
    return (
      <img
        src={photo}
        alt={name}
        className={className}
        onError={() => setFailed(true)}
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
