'use client';

import { useState, useEffect } from 'react';
import { CreditCard, Settings as SettingsIcon, User } from 'lucide-react';
import { VendorHeader } from '@/components/vendor/VendorHeader';
import { VendorPaymentSettings } from './VendorPaymentSettings';
import { VendorGeneralSettings } from './VendorGeneralSettings';
import { VendorProfileSettings } from './VendorProfileSettings';

interface VendorSettingsScreenProps {
  vendorId: string;
  vendorData?: any;
  onBack: () => void;
  /** Initial tab when opened from URL (e.g. ?tab=bank → payment) */
  initialTab?: 'general' | 'payment' | 'profile';
}

type SettingsTab = 'general' | 'payment' | 'profile';

export function VendorSettingsScreen({ vendorId, vendorData, onBack, initialTab }: VendorSettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab || 'general');

  useEffect(() => {
    if (initialTab && ['general', 'payment', 'profile'].includes(initialTab)) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className="fixed inset-0 z-20 flex flex-col bg-gray-50">
      <div className="vendor-app-column flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <VendorHeader title="Settings" onBack={onBack} />

        <div className="shrink-0 border-b border-gray-200 bg-white px-4 pb-1">
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

      <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-24">
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
    </div>
  );
}
