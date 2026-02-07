'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SellerHub } from '@/components/vendor/seller/SellerHub';
import { apiClient } from '@/lib/api-client';

export default function SellerPage() {
  const router = useRouter();
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVendorData();
  }, []);

  const loadVendorData = async () => {
    try {
      // Get vendor data from localStorage (set during login)
      const stored = localStorage.getItem('vendorData');
      if (stored) {
        const parsed = JSON.parse(stored);
        setVendorData(parsed);
        setLoading(false);
        return;
      }

      // Try to get vendor from session
      const phone = localStorage.getItem('vendorPhone');
      if (phone) {
        const data = await apiClient.get<{ vendor?: any }>(`/vendor/by-phone/${phone}`);
        if (data?.vendor) {
          setVendorData(data.vendor);
          localStorage.setItem('vendorData', JSON.stringify(data.vendor));
        }
      }
    } catch (error) {
      console.error('Error loading vendor data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('vendorData');
    localStorage.removeItem('vendorPhone');
    localStorage.removeItem('vendorId');
    router.push('/');
  };

  const handleBack = () => {
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Seller Hub...</p>
        </div>
      </div>
    );
  }

  if (!vendorData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center max-w-md p-8 bg-white rounded-2xl shadow-lg">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Session Expired</h2>
          <p className="text-gray-600 mb-6">Please log in again to access the Seller Hub.</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <SellerHub 
      vendorData={vendorData} 
      onLogout={handleLogout}
      onBack={handleBack}
    />
  );
}
