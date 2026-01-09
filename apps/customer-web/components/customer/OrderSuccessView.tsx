"use client";

import { useState } from 'react';
import { CheckCircle, Home, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderSuccessViewProps {
  orderId: string;
  onTrackOrder: () => void;
  onBackToHome: () => void;
  onViewOrders: () => void;
}

export function OrderSuccessView({ orderId, onTrackOrder, onBackToHome, onViewOrders }: OrderSuccessViewProps) {
  // Placeholder component - to be implemented with full order success view
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-xl p-6 shadow-sm text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
          <p className="text-gray-600 mb-6">Order ID: {orderId}</p>
          
          <div className="space-y-3">
            <Button
              onClick={onTrackOrder}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Track Order
            </Button>
            <Button
              onClick={onViewOrders}
              variant="outline"
              className="w-full"
            >
              View Orders
            </Button>
            <Button
              onClick={onBackToHome}
              variant="ghost"
              className="w-full"
            >
              <Home className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

