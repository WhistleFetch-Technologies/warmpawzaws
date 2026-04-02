"use client";

import { CustomerShopOrdersScreen } from '@/components/customer/CustomerShopOrdersScreen';
import type { ShopReturnSpaScreen } from '@/lib/go-back-or-replace';

interface OrderHistoryPageProps {
  onBack?: () => void;
  onCloseToHome?: () => void;
  onNavigate?: (path: string) => void;
  spaShopReturnScreen?: ShopReturnSpaScreen;
}

export function OrderHistoryPage({ onBack, onCloseToHome, spaShopReturnScreen }: OrderHistoryPageProps = {}) {
  return (
    <CustomerShopOrdersScreen
      onBack={onBack}
      onCloseToHome={onCloseToHome}
      spaShopReturnScreen={spaShopReturnScreen}
    />
  );
}
