'use client';

import { CustomerWallet } from '@/components/customer/CustomerWallet';
import { useEffect, useState } from 'react';

export default function WalletPage() {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  if (!phone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to view your wallet</p>
          <a href="/auth" className="mt-4 inline-block px-6 py-2 bg-orange-500 text-white rounded-full">
            Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      {/* Header - Match consistency pattern: max-w-7xl mx-auto px-6 py-4 */}
      <div className="bg-white/90 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">My Wallet</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your wallet balance and transactions</p>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <CustomerWallet customerPhone={phone} />
        </div>
      </div>
    </div>
  );
}

