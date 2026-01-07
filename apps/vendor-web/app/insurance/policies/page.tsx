'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Shield, Search, Filter } from 'lucide-react';
import { VendorPolicyManagement } from '@/components/vendor/VendorPolicyManagement';

export default function InsurancePoliciesPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const id = localStorage.getItem('vendorId');
    if (!id) {
      router.push('/');
      return;
    }
    setVendorId(id);
    setLoading(false);
  }, [router]);

  if (loading || !vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            Back
          </button>
          <h1 className="text-2xl font-bold text-gray-900">📄 Insurance Policies</h1>
          <p className="text-sm text-gray-500">Manage active insurance policies</p>
        </div>
        <VendorPolicyManagement vendorId={vendorId} onClose={() => router.back()} />
      </div>
    </div>
  );
}

