'use client';

import { useState } from 'react';
import { initials } from '@/components/admin/warmpawz-insurance/catalogue/catalogue-format';

const SIZES = {
  sm: 'h-8 w-8 rounded-md text-[11px]',
  md: 'h-12 w-12 rounded-lg text-sm',
};

export function CompanyLogo({
  name,
  logoUrl,
  size = 'md',
}: {
  name: string;
  logoUrl: string | null;
  size?: keyof typeof SIZES;
}) {
  const [broken, setBroken] = useState(false);
  if (logoUrl && !broken) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={`${SIZES[size]} shrink-0 border border-gray-200 bg-white object-contain p-0.5`}
        onError={() => setBroken(true)}
      />
    );
  }
  return (
    <span
      className={`${SIZES[size]} flex shrink-0 items-center justify-center bg-orange-100 font-semibold text-orange-700`}
    >
      {initials(name)}
    </span>
  );
}
