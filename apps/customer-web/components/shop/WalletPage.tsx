"use client";

import { CustomerWallet } from '@/components/customer/CustomerWallet';
import { useEffect, useState } from 'react';

interface WalletPageProps {
  onNavigate?: (path: string) => void;
}

export function WalletPage({ onNavigate }: WalletPageProps = {}) {
  const [phone, setPhone] = useState<string | null>(null);

  useEffect(() => {
    const storedPhone = localStorage.getItem('customerPhone');
    setPhone(storedPhone);
  }, []);

  if (!phone) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Wallet</h1>
        <p className="text-gray-500">Please login to view your wallet</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">My Wallet</h1>
      <CustomerWallet customerPhone={phone} />
    </div>
  );
}

