'use client';

import { RewardsLoyaltyPage } from '@/components/customer/RewardsLoyaltyPage';
import { goBackOrHome, handleWalletChildPageBack } from '@/lib/go-back-or-replace';
import { AppReviewDemoRouteGuard } from '@/lib/app-review-demo-route-guard';
import { useRouter } from 'next/navigation';

export default function RewardsPage() {
  const router = useRouter();

  return (
    <AppReviewDemoRouteGuard>
      <RewardsLoyaltyPage
        onBack={() => handleWalletChildPageBack(router)}
        onCloseToHome={() => goBackOrHome(router)}
      />
    </AppReviewDemoRouteGuard>
  );
}
