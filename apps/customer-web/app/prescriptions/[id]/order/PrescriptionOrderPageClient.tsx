'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { PharmacyOrderFlow } from '../../../../components/customer/specialized/PharmacyOrderFlow';

function PrescriptionOrderPageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const prescriptionId = params.id as string;

  useEffect(() => {
    // Get customer phone from URL (e.g. ?phone=xxx) or localStorage
    const phoneFromUrl = searchParams?.get('phone');
    const storedPhone = typeof window !== 'undefined'
      ? localStorage.getItem('customerPhone') || localStorage.getItem('customer_phone') || localStorage.getItem('phone')
      : null;
    
    const phone = phoneFromUrl || storedPhone;
    if (phone) {
      setCustomerPhone(phone);
    }
    
    setLoading(false);
  }, [searchParams]);

  const handleBack = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!customerPhone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Log In Required</h1>
          <p className="text-slate-500 mb-4">
            Please log in with your phone number to order medicine from your prescription. 
            You can also use the app and go to My Bookings → select booking → Prescription History → Order Medicine.
          </p>
          <button
            onClick={() => router.push(`/auth?redirect=/prescriptions/${prescriptionId}/order`)}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
          >
            Log In
          </button>
          <button
            onClick={handleBack}
            className="block mt-3 text-slate-500 hover:text-slate-700 text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PharmacyOrderFlow
        prescriptionId={prescriptionId}
        customerPhone={customerPhone}
        customerId={customerPhone}
        onBack={handleBack}
        onComplete={(orderId) => {
          router.push(orderId ? `/track/${orderId}` : '/');
        }}
      />
    </div>
  );
}

export default function PrescriptionOrderPageClient() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
      </div>
    }>
      <PrescriptionOrderPageContent />
    </Suspense>
  );
}
