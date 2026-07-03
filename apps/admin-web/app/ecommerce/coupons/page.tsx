'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Legacy route — merged into /ecommerce/promotions (Coupons tab). */
export default function ECommerceCouponsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ecommerce/promotions');
  }, [router]);
  return null;
}
