"use client";

import { CustomerWallet } from '@/components/customer/CustomerWallet';
import { ProfileAccountScreenHeader } from '@/components/customer/shared/ProfileAccountScreenHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface WalletPageProps {
  onBack?: () => void;
  onCloseToHome?: () => void;
  onNavigate?: (path: string) => void;
}

export function WalletPage({ onBack, onCloseToHome, onNavigate }: WalletPageProps = {}) {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  const title = phone ? 'My Wallet' : 'Wallet';

  const headerBar = onCloseToHome ? (
    <ProfileAccountScreenHeader
      onCloseToHome={onCloseToHome}
      onBack={onBack}
      title={title}
      className="mb-4"
    />
  ) : (
    <header className="shrink-0 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-5 rounded-b-[1.75rem] shadow-md mb-4">
      <div className="flex items-center gap-2">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full text-white hover:bg-white/20"
            aria-label="Go back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-xl font-bold">{title}</h1>
      </div>
    </header>
  );

  if (!phone) {
    return (
      <div className="w-full flex flex-col bg-[#FAF6F0] min-h-screen rounded-t-3xl overflow-hidden">
        {headerBar}
        <div className="px-4 pb-6">
          <p className="text-gray-600 text-center">Please login to view your wallet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-[#FAF6F0] min-h-screen rounded-t-3xl overflow-hidden">
      {headerBar}
      <div className="flex-1 min-h-0 px-4 pb-2">
        <CustomerWallet customerPhone={phone} onNavigate={onNavigate} />
      </div>
    </div>
  );
}

