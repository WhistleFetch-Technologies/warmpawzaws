"use client";

import { useState } from 'react';
import { ArrowLeft, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderTrackingViewProps {
  orderId: string;
  onBack: () => void;
}

export function OrderTrackingView({ orderId, onBack }: OrderTrackingViewProps) {
  // Placeholder component - to be implemented with full order tracking
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
          <h1 className="text-xl font-semibold">Track Order</h1>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="text-center">
            <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Order ID: {orderId}</p>
            <p className="text-gray-600">Order tracking coming soon</p>
          </div>
        </div>
      </div>
    </div>
  );
}

