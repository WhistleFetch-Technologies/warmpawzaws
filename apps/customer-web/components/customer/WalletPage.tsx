"use client";

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomerWallet } from './CustomerWallet';

interface WalletPageProps {
  customerPhone?: string;
  customerId?: string;
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}

export function WalletPage({ customerPhone, customerId, onBack, onNavigate }: WalletPageProps) {
  // Get phone from props or localStorage
  const phone = customerPhone || (typeof window !== 'undefined' ? localStorage.getItem('customerPhone') : null);

  if (!phone) {
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
            <p className="text-gray-600 text-center">Please login to view your wallet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          {onBack && (
            <div className="flex items-center gap-4 mb-2">
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </div>
          )}
          <h1 className="text-2xl font-bold text-gray-800">My Wallet</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your wallet balance and transactions</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <CustomerWallet customerPhone={phone} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
