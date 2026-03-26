'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorPetInsuranceIssuedPolicies } from '@/components/vendor/insurance/VendorPetInsuranceIssuedPolicies';

export default function InsurancePoliciesPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem('vendorId');
    if (!id) {
      router.push('/');
      return;
    }
    setVendorId(id);
  }, [router]);

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  return <VendorPetInsuranceIssuedPolicies vendorId={vendorId} />;
}
