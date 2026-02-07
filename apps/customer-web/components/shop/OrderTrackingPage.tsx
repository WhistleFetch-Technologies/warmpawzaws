"use client";

import { OrderTrackingView } from '@/components/customer/OrderTrackingView';

interface OrderTrackingPageProps {
  orderId: string;
  onBack?: () => void;
}

export function OrderTrackingPage({ orderId, onBack }: OrderTrackingPageProps) {
  return (
    <OrderTrackingView 
      orderId={orderId} 
      onBack={onBack || (() => window.history.back())} 
    />
  );
}

