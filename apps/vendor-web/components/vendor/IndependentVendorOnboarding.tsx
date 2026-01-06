'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Building2, MapPin, Phone, Loader2, CheckCircle } from 'lucide-react';

interface IndependentVendorOnboardingProps {
  onSuccess?: () => void;
}

export function IndependentVendorOnboarding({ onSuccess }: IndependentVendorOnboardingProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formData, setFormData] = useState({
    vendorName: '',
    vendorType: 'pharmacy' as 'ambulance' | 'pharmacy' | 'diagnostics',
    address: '',
    phone: '',
    email: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vendorName || !formData.address || !formData.phone) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await apiClient.post<any>('/integrated-services/vendor/onboard-independent', {
        vendorName: formData.vendorName,
        vendorType: formData.vendorType,
        location: { lat: 0, lng: 0, address: formData.address },
        contactInfo: { phone: formData.phone, email: formData.email },
      });

      if (response.success) {
        setSuccess(true);
        if (onSuccess) onSuccess();
      } else {
        alert('Failed to submit application');
      }
    } catch (error) {
      console.error('Error submitting application:', error);
      alert('Error submitting application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto flex items-center justify-center p-4">
        <div className="bg-white rounded-lg border-2 border-green-200 p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Onboarding Submitted!</h2>
          <p className="text-gray-600">Your application is under review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Independent Vendor Onboarding</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Name *
            </label>
            <input
              type="text"
              value={formData.vendorName}
              onChange={(e) => setFormData(prev => ({ ...prev, vendorName: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter vendor name"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor Type *
            </label>
            <select
              value={formData.vendorType}
              onChange={(e) => setFormData(prev => ({ ...prev, vendorType: e.target.value as any }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="ambulance">Ambulance</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="diagnostics">Diagnostics Center</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address *
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              rows={3}
              placeholder="Enter full address"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter phone number"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter email (optional)"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Application'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

