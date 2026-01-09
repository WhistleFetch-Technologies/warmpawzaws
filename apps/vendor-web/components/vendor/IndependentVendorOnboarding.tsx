'use client';

import React, { useState } from 'react';
import { Building2, MapPin, Clock, Phone } from 'lucide-react';

export function IndependentVendorOnboarding({ apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api' }) {
  const [vendorName, setVendorName] = useState('');
  const [vendorType, setVendorType] = useState<'ambulance' | 'pharmacy' | 'diagnostics'>('pharmacy');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    await fetch(`${apiUrl}/integrated-services/vendor/onboard-independent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendorName,
        vendorType,
        location: { lat: 0, lng: 0, address },
        contactInfo: { phone, email: '' },
      }),
    });
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
        <h2>Onboarding Submitted!</h2>
        <p className="text-gray-600 mt-2">Your application is under review</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <h2>Independent Vendor Onboarding</h2>
      <div className="space-y-4">
        <div>
          <label className="block mb-2">Vendor Name</label>
          <input
            type="text"
            value={vendorName}
            onChange={e => setVendorName(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <div>
          <label className="block mb-2">Vendor Type</label>
          <select
            value={vendorType}
            onChange={e => setVendorType(e.target.value as any)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          >
            <option value="ambulance">Ambulance</option>
            <option value="pharmacy">Pharmacy</option>
            <option value="diagnostics">Diagnostics Center</option>
          </select>
        </div>
        <div>
          <label className="block mb-2">Address</label>
          <textarea
            value={address}
            onChange={e => setAddress(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
            rows={3}
          />
        </div>
        <div>
          <label className="block mb-2">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="w-full p-3 border border-gray-300 rounded-lg"
          />
        </div>
        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700"
        >
          Submit Application
        </button>
      </div>
    </div>
  );
}
