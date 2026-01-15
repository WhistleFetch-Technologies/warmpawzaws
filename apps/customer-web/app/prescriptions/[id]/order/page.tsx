'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PrescriptionOrderFlow from '../../../../components/customer/pharmacy/PrescriptionOrderFlow';

export default function PrescriptionOrderPage() {
  const params = useParams();
  const router = useRouter();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const prescriptionId = params.id as string;

  useEffect(() => {
    // Get customer info from localStorage or session
    const storedCustomerId = localStorage.getItem('customerId');
    
    if (storedCustomerId) {
      setCustomerId(storedCustomerId);
    }
    setLoading(false);
  }, []);

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!customerId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Please Log In</h1>
          <p className="text-slate-500 mb-4">Log in to order medicine from your prescription</p>
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
    <PrescriptionOrderFlow
      prescriptionId={prescriptionId}
      customerId={customerId}
      onBack={handleBack}
    />
  );
}
