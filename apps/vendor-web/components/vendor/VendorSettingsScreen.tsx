'use client';

import { useState } from 'react';
import { ChevronRight, CreditCard, Settings as SettingsIcon, User, LogOut } from 'lucide-react';
import { VendorPaymentSettings } from './VendorPaymentSettings';
import { VendorGeneralSettings } from './VendorGeneralSettings';
import { VendorProfileSettings } from './VendorProfileSettings';

interface VendorSettingsScreenProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
}

type SettingsTab = 'general' | 'payment' | 'profile';

export function VendorSettingsScreen({ vendorId, vendorData, onBack }: VendorSettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  return (
    <div className="fixed inset-0 bg-gray-50 z-20 overflow-y-auto pb-24">
      <div className="p-4 bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full">
            <ChevronRight className="w-5 h-5 rotate-180 text-gray-600" />
          </button>
          <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <SettingsIcon className="w-4 h-4" />
              General
            </div>
          </button>
          <button
            onClick={() => setActiveTab('payment')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'payment'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Payment & Payouts
            </div>
          </button>
          {/* ✅ NEW: Profile Tab */}
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'profile'
                ? 'border-[#FF8C42] text-[#FF8C42]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              Profile
            </div>
          </button>
        </div>
      </div>

      <div className="p-4">
        {activeTab === 'general' && (
          <VendorGeneralSettings vendorId={vendorId} vendorData={vendorData} onBack={onBack} />
        )}
        {activeTab === 'payment' && (
          <VendorPaymentSettings vendorId={vendorId} vendorData={vendorData} onBack={onBack} />
        )}
        {/* ✅ NEW: Profile Tab */}
        {activeTab === 'profile' && (
          <VendorProfileSettings vendorId={vendorId} vendorData={vendorData} onBack={onBack} />
        )}
      </div>
    </div>
  );
}
