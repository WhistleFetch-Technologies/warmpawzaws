'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

type EcommerceRouteRedirectProps = {
  href: string;
};

/** SPA screens that should use dedicated Next routes for marketplace cart/checkout. */
export function EcommerceRouteRedirect({ href }: EcommerceRouteRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    router.replace(href);
  }, [href, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-[#FF8C42]" />
    </div>
  );
}
