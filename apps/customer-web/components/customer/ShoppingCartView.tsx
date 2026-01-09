"use client";

import { useState } from 'react';
import { ArrowLeft, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShoppingCartViewProps {
  onBack: () => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
}

export function ShoppingCartView({ onBack, onCheckout, onContinueShopping }: ShoppingCartViewProps) {
  // Placeholder component - to be implemented with full shopping cart
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
          <h1 className="text-xl font-semibold">Shopping Cart</h1>
        </div>
        
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex flex-col items-center justify-center py-12">
            <ShoppingCart className="w-16 h-16 text-gray-300 mb-4" />
            <p className="text-gray-600 text-center mb-6">Your cart is empty</p>
            <Button
              onClick={onContinueShopping}
              className="bg-[#FF8C42] hover:bg-[#FF7A29] text-white"
            >
              Continue Shopping
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

