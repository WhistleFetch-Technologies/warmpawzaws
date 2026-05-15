"use client";

import { CustomerWallet } from '@/components/customer/CustomerWallet';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';
import { Wallet } from 'lucide-react';
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

  const headerBar = (
    <ServiceDashboardHeader
      serviceName={title}
      serviceSubtitle="Balance & transactions"
      serviceIcon={Wallet}
      iconColor="text-white"
      stats={[]}
      onBack={onBack}
      showBackButton={Boolean(onBack)}
      onCloseToHome={onCloseToHome}
      bottomEdge="sheet"
      sheetToneClass="bg-[#FAF6F0]"
    />
  );

  if (!phone) {
    return (
      <div className="w-full flex flex-col bg-[#FAF6F0] min-h-screen overflow-hidden max-w-customer mx-auto">
        {headerBar}
        <div className="-mt-1 px-4 pb-6 pt-2">
          <p className="text-gray-600 text-center">Please login to view your wallet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col bg-[#FAF6F0] min-h-screen overflow-hidden max-w-customer mx-auto">
      {headerBar}
      <div className="-mt-1 flex-1 min-h-0 px-4 pb-2 pt-2">
        <CustomerWallet customerPhone={phone} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
