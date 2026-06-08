'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { navigateToProfileShopOrders } from '@/lib/go-back-or-replace';

type ProfileOrdersRedirectProps = {
  orderId?: string;
};

/** Resume profile My Orders on `/` (used by legacy SPA order_success screens). */
export function ProfileOrdersRedirect({ orderId }: ProfileOrdersRedirectProps) {
  const router = useRouter();

  useEffect(() => {
    navigateToProfileShopOrders(router, orderId);
  }, [orderId, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-200 border-t-[#FF8C42]" />
    </div>
  );
}
