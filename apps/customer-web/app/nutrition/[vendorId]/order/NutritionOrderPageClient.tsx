'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import NutritionOrderFlow from '../../../../components/customer/nutrition/NutritionOrderFlow';
import { apiClient } from '@/lib/api-client';

export default function NutritionOrderPageClient() {
  const params = useParams();
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string>('Nutritionist');
  const [loading, setLoading] = useState(true);

  const vendorId = params.vendorId as string;

  useEffect(() => {
    const fetchData = async () => {
      // Get customer info from localStorage
      const storedCustomerId = localStorage.getItem('customerId');
      if (storedCustomerId) {
        setCustomerId(storedCustomerId);
      }

      // Fetch vendor details
      try {
        const response = await apiClient.get(`/vendors/${vendorId}`);
        if (response && (response as any).vendor) {
          setVendorName((response as any).vendor.business_name || 'Nutritionist');
        }
      } catch (error) {
        console.error('Error fetching vendor:', error);
      }

      setLoading(false);
    };
    fetchData();
  }, [vendorId]);

  const handleBack = () => {
    router.back();
  };

  const handleSuccess = (orderId: string) => {
    console.log('Order placed:', orderId);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!customerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Please Log In</h1>
          <p className="text-slate-500 mb-4">Log in to order fresh pet meals</p>
          <button
            onClick={() => router.push('/auth')}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Log In
          </button>
        </div>
      </div>
    );
  }

  return (
    <NutritionOrderFlow
      vendorId={vendorId}
      vendorName={vendorName}
      customerId={customerId}
      onBack={handleBack}
      onSuccess={handleSuccess}
    />
  );
}
