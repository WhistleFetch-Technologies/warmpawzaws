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
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 p-4">
        <div className="max-w-md mx-auto">
          <div className="bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-3 rounded-b-2xl shadow-md mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full text-white hover:bg-white/20">
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <h1 className="text-xl font-semibold text-white">Wallet</h1>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm text-center">
            <p className="text-gray-600">Please login to view your wallet</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <div className="max-w-md mx-auto min-h-screen">
        <div className="sticky top-0 z-10 bg-gradient-to-r from-[#FF8C42] via-[#FF7A35] to-[#FF6B35] text-white px-4 py-3 rounded-b-2xl shadow-md">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={props.onBack} className="rounded-full text-white hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold text-white">My Wallet</h1>
          </div>
        </div>
        <div className="p-4">
          <CustomerWallet customerPhone={phone} />
        </div>
      </div>
    </div>
  );
}
