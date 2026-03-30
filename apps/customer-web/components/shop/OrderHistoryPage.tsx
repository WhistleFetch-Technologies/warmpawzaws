"use client";

import { CustomerShopOrdersScreen } from '@/components/customer/CustomerShopOrdersScreen';

interface OrderHistoryPageProps {
  onBack?: () => void;
  onNavigate?: (path: string) => void;
}

export function OrderHistoryPage({ onBack }: OrderHistoryPageProps = {}) {
  return <CustomerShopOrdersScreen onBack={onBack} />;
}
