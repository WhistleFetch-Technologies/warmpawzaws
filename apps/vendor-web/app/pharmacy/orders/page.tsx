'use client';

import React, { useEffect, useState } from 'react';
import PharmacyOrderDashboard from '../../../components/vendor/pharmacy/PharmacyOrderDashboard';

export default function PharmacyOrdersPage() {
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get vendor info from localStorage (set by VendorAuth / VendorApp on login)
    let storedVendorId = localStorage.getItem('vendorId');
    let storedVendorName = localStorage.getItem('vendorName') || localStorage.getItem('businessName');
    // Fallback: parse vendorData so /pharmacy/orders works after refresh before rehydration
    if (!storedVendorId) {
      try {
        const vendorDataStr = localStorage.getItem('vendorData');
        if (vendorDataStr) {
          const vendorData = JSON.parse(vendorDataStr);
          storedVendorId = vendorData.id || vendorData.vendorId || null;
          storedVendorName = storedVendorName || vendorData.business_name || vendorData.businessName || 'Pharmacy';
        }
      } catch (_) {}
    }
    if (storedVendorId) {
      setVendorId(storedVendorId);
      setVendorName(storedVendorName || 'Pharmacy');
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!vendorId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Not Logged In</h1>
          <p className="text-slate-500">Please log in to access pharmacy orders</p>
        </div>
      </div>
    );
  }

  return <PharmacyOrderDashboard vendorId={vendorId} vendorName={vendorName} />;
}
