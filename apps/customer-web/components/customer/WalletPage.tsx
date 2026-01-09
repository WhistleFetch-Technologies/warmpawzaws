"use client";

import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WalletPageProps {
  customerPhone?: string;
  customerId?: string;
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}

export function WalletPage({ customerPhone, customerId, onBack, onNavigate }: WalletPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        {onBack && (
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Wallet</h1>
          </div>
        )}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <p className="text-gray-600 text-center">Wallet coming soon</p>
        </div>
      </div>
    </div>
  );
}
