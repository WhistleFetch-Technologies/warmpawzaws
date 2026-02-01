'use client';

export const dynamic = 'force-dynamic';

import { VendorSettingsPage } from '@/components/vendor/VendorSettingsPage';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';

function SettingsContent() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    setVendorId(storedVendorId);
  }, []);

  if (!vendorId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-full max-w-[430px] mx-auto bg-white p-6 text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🔒</span>
          </div>
          <p className="text-gray-600 mb-4">Please login to access settings</p>
          <a 
            href="/auth" 
            className="inline-block px-6 py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors"
          >
            Login
          </a>
        </div>
      </div>
    );
  }

  return <VendorSettingsPage vendorId={vendorId} onBack={() => router.back()} />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}
