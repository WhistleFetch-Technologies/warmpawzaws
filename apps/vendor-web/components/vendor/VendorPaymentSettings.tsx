'use client';

import { useState } from 'react';
import { CreditCard, Building2, Wallet, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VendorPaymentSettingsProps {
  vendorId: string;
  vendorData?: any;
  onBack?: () => void;
  onClose?: () => void;
}

export function VendorPaymentSettings({ vendorId, vendorData, onBack, onClose }: VendorPaymentSettingsProps) {
  const [paymentMethod, setPaymentMethod] = useState<'bank' | 'upi' | 'wallet'>('bank');

  // Placeholder component - to be implemented with full payment settings
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Payment Settings</h2>
        {onClose && (
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">Close</button>
        )}
      </div>

      <div className="space-y-4">
        <div className="flex gap-4">
          <button
            onClick={() => setPaymentMethod('bank')}
            className={`flex-1 p-4 rounded-lg border-2 ${
              paymentMethod === 'bank'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Building2 className="w-6 h-6 mb-2 text-gray-600" />
            <p className="font-semibold">Bank Account</p>
          </button>
          <button
            onClick={() => setPaymentMethod('upi')}
            className={`flex-1 p-4 rounded-lg border-2 ${
              paymentMethod === 'upi'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <CreditCard className="w-6 h-6 mb-2 text-gray-600" />
            <p className="font-semibold">UPI</p>
          </button>
          <button
            onClick={() => setPaymentMethod('wallet')}
            className={`flex-1 p-4 rounded-lg border-2 ${
              paymentMethod === 'wallet'
                ? 'border-blue-600 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <Wallet className="w-6 h-6 mb-2 text-gray-600" />
            <p className="font-semibold">Wallet</p>
          </button>
        </div>

        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <p className="text-gray-600 text-sm">
            Payment settings functionality coming soon. You'll be able to configure your preferred payment method here.
          </p>
        </div>
      </div>
    </div>
  );
}

