'use client';

import { ReferralSystemPage } from '@/components/customer/ReferralSystemPage';
import { goBackOrHome, handleWalletChildPageBack } from '@/lib/go-back-or-replace';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ReferralsPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | undefined>(undefined);

  useEffect(() => {
    const stored = localStorage.getItem('customerPhone');
    setPhone(stored ?? undefined);
  }, []);

  return (
    <AppReviewDemoRouteGuard>
      <ReferralSystemPage
        customerPhone={phone}
        customerId={phone}
        onBack={() => handleWalletChildPageBack(router)}
        onCloseToHome={() => goBackOrHome(router)}
      />
    </AppReviewDemoRouteGuard>
  );
}
