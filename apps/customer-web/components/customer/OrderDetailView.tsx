"use client";

import { useState } from 'react';
import { ArrowLeft, Package, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface OrderDetailViewProps {
  order: any;
  onBack: () => void;
  onTrackOrder: () => void;
  onReorder: () => void;
  onHelp: () => void;
}

export function OrderDetailView({ order, onBack, onTrackOrder, onReorder, onHelp }: OrderDetailViewProps) {
  // Placeholder component - to be implemented with full order details
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
          <h1 className="text-xl font-semibold">Order Details</h1>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="mb-4">
            <p className="text-sm text-gray-500">Order ID</p>
            <p className="text-lg font-semibold">{order.id || order.orderId || 'N/A'}</p>
          </div>
          
          <div className="space-y-3 mt-6">
            <Button
              onClick={onTrackOrder}
              className="w-full bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              <Package className="w-4 h-4 mr-2" />
              Track Order
            </Button>
            <Button
              onClick={onReorder}
              variant="outline"
              className="w-full"
            >
              Reorder
            </Button>
            <Button
              onClick={onHelp}
              variant="ghost"
              className="w-full"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Help & Support
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

