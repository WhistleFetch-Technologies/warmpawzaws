'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorCapabilityDashboard } from '@/components/vendor/VendorCapabilityDashboard';
import { apiClient } from '@/lib/api-client';

export default function VendorHomePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorStatus, setVendorStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkVendorStatus();
  }, []);

  const checkVendorStatus = async () => {
    try {
      const storedVendorId = localStorage.getItem('vendorId');
      const storedPhone = localStorage.getItem('onboarding_phone');

      if (!storedVendorId && !storedPhone) {
        // No vendor data at all - redirect to onboarding
        router.push('/onboarding');
        return;
      }

      if (storedVendorId) {
        // Check vendor status from API
        const response = await apiClient.get<any>(`/vendor/${storedVendorId}/status`);
        
        if (response.status === 'approved' || response.status === 'active') {
          setVendorId(storedVendorId);
          setVendorStatus('active');
        } else if (response.status === 'pending') {
          router.push('/onboarding');
        } else if (response.status === 'rejected') {
          router.push('/onboarding');
        } else if (response.status === 'clarification_requested') {
          router.push('/onboarding');
        }
      } else if (storedPhone) {
        // Check by phone number
        const response = await apiClient.get<any>(`/vendor/check-phone/${storedPhone}`);
        
        if (response.exists && (response.status === 'approved' || response.status === 'active')) {
          localStorage.setItem('vendorId', response.vendorId);
          setVendorId(response.vendorId);
          setVendorStatus('active');
        } else {
          router.push('/onboarding');
        }
      }
    } catch (err) {
      console.error('Error checking vendor status:', err);
      // On error, redirect to onboarding
      router.push('/onboarding');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!vendorId || vendorStatus !== 'active') {
    return null; // Will redirect
  }

  return <VendorCapabilityDashboard vendorId={vendorId} />;
}

