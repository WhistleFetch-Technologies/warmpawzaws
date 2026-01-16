"use client";

import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CustomerWallet } from './CustomerWallet';

interface CustomerWalletPageProps {
  phone?: string;
  customerPhone?: string;
  customerId?: string;
  petId?: string;
  bookingId?: string;
  orderId?: string;
  cafeId?: string;
  preSelectedVendorId?: string;
  vendorId?: string;
  onBack: () => void;
  onNavigate?: (screen: string, data?: any) => void;
  onSuccess?: (bookingId?: string) => void;
  onComplete?: () => void;
}

export function CustomerWalletPage(props: CustomerWalletPageProps) {
  const phone = props.customerPhone || props.phone;
  
  if (!phone) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">Wallet</h1>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-gray-600">Please login to view your wallet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen">
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">My Wallet</h1>
          </div>
        </div>
        <div className="p-4">
          <CustomerWallet customerPhone={phone} />
        </div>
      </div>
    </div>
  );
}
