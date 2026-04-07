"use client";

import { Wallet } from 'lucide-react';
import { CustomerWallet } from './CustomerWallet';
import { ServiceDashboardHeader } from '@/components/customer/shared/ServiceDashboardHeader';

interface WalletPageProps {
  customerPhone?: string;
  customerId?: string;
  onBack?: () => void;
  onNavigate?: (screen: string) => void;
}

export function WalletPage({ customerPhone, onBack, onNavigate }: WalletPageProps) {
  const phone =
    customerPhone || (typeof window !== 'undefined' ? localStorage.getItem('customerPhone') : null);

  const header = (
    <ServiceDashboardHeader
      serviceName={phone ? 'My Wallet' : 'Wallet'}
      serviceSubtitle="Balance & transactions"
      serviceIcon={Wallet}
      iconColor="text-white"
      stats={[]}
      onBack={onBack}
      showBackButton={Boolean(onBack)}
    />
  );

  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 max-w-customer mx-auto">
        {header}
        <div className="px-4 pt-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <p className="text-gray-600 text-center">Please login to view your wallet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 max-w-customer mx-auto">
      {header}
      <div className="px-4 pb-6 pt-4">
        <CustomerWallet customerPhone={phone} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
