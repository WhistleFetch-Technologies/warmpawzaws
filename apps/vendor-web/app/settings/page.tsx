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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600">Please login to access settings</p>
          <a href="/auth" className="mt-4 inline-block px-6 py-2 bg-orange-500 text-white rounded-full">
            Login
          </a>
        </div>
      </div>
    );
  }

  return <VendorSettingsPage vendorId={vendorId} />;
}

