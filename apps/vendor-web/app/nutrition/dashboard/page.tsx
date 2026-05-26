'use client';

import React, { useEffect, useState } from 'react';
import NutritionistDashboard from '../../../components/vendor/nutrition/NutritionistDashboard';
import { apiClient } from '../../../lib/api-client';

export default function NutritionDashboardPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const storedVendorId = localStorage.getItem('vendorId');
      const storedVendorName = localStorage.getItem('vendorName') || localStorage.getItem('businessName');

      if (storedVendorId) {
        setVendorId(storedVendorId);
        setVendorName(storedVendorName || 'Nutritionist Kitchen');
      }

      // Resolve vendors.id from profile (localStorage may still hold vendor_identity id).
      if (storedVendorId) {
        try {
          const profileResponse = await apiClient.get<any>(`/vendor/${storedVendorId}/profile`);
          const profileData = profileResponse?.data || profileResponse;
          const profileVendor = profileData?.vendor;
          if (profileData?.success !== false && profileVendor?.id) {
            const canonicalId = String(profileVendor.id);
            if (canonicalId !== storedVendorId) {
              localStorage.setItem('vendorId', canonicalId);
            }
            setVendorId(canonicalId);
            const name =
              profileVendor.business_name ||
              profileVendor.businessName ||
              storedVendorName ||
              'Nutritionist Kitchen';
            setVendorName(name);
            localStorage.setItem('vendorName', name);
          }
        } catch {
          /* keep stored id — API meal-orders also resolves identity ids */
        }
      }

      setLoading(false);
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Not Logged In</h1>
          <p className="text-slate-500">Please log in to access your nutrition dashboard</p>
        </div>
      </div>
    );
  }

  return <NutritionistDashboard vendorId={vendorId} vendorName={vendorName} />;
}
