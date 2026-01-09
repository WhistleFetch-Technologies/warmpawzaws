"use client";

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CheckoutViewProps {
  phone: string;
  onBack: () => void;
  onSuccess: (orderId: string) => void;
}

export function CheckoutView({ phone, onBack, onSuccess }: CheckoutViewProps) {
  // Placeholder component - to be implemented with full checkout flow
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-semibold">Checkout</h1>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-600 text-center mb-6">
            Checkout flow coming soon
          </p>
          <Button
            onClick={() => onSuccess('order_123')}
            className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
          >
            Place Order
          </Button>
        </div>
      </div>
    </div>
  );
}

