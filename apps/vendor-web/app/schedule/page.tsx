'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { AdvancedAvailabilityManager } from '@/components/vendor/AdvancedAvailabilityManager';

/**
 * Schedule page - uses Advanced Availability Manager (no legacy scheduler).
 * Matches dashboard flow: GET/POST /vendor/:vendorId/availability and schedule
 * are handled by AdvancedAvailabilityManager; avoids legacy GET /vendor/:vendorId/schedule
 * response shape that could cause "l.map is not a function".
 */
export default function SchedulePage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = typeof localStorage !== 'undefined' ? localStorage.getItem('vendorId') : null;
    if (!id) {
      router.push('/onboarding');
      return;
    }
    setVendorId(id);
    loadVendorProfile(id);
  }, [router]);

  const loadVendorProfile = async (id: string) => {
    try {
      const profile = await apiClient.get<any>(`/vendor/${id}/profile`).catch(() => null);
      if (profile && profile.vendor) {
        setVendorData(profile.vendor);
      }
    } catch {
      // Optional: continue without profile
    } finally {
      setLoading(false);
    }
  };

  if (loading || !vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-amber-50">
      <AdvancedAvailabilityManager
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => router.push('/')}
      />
    </div>
  );
}
