"use client";

import { CustomerWallet } from '@/components/customer/CustomerWallet';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface WalletPageProps {
  onBack?: () => void;
  onNavigate?: (path: string) => void;
}

export function WalletPage({ onBack, onNavigate }: WalletPageProps = {}) {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  const headerBar = (
    <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-4 -mx-6 mt-0 mb-6 rounded-b-2xl shadow-md">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full text-white hover:bg-white/20">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-xl font-bold">{phone ? 'My Wallet' : 'Wallet'}</h1>
      </div>
    </div>
  );

  if (!phone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="p-6">
          {headerBar}
          <p className="text-gray-600">Please login to view your wallet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="p-6">
        {headerBar}
        <CustomerWallet customerPhone={phone} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

