'use client';

export const dynamic = 'force-dynamic';

import { VendorSettingsPage } from '@/components/vendor/VendorSettingsPage';
import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    setVendorId(storedVendorId);
  }, []);

  if (!vendorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please login to access settings</p>
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
      <div className="bg-white/80 backdrop-blur-sm border-b border-orange-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account settings and preferences</p>
        </div>
      </div>

      {/* Main Content - Match consistency pattern: max-w-7xl mx-auto p-6 */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <VendorSettingsPage vendorId={vendorId} />
        </div>
      </div>
    </div>
  );
}

