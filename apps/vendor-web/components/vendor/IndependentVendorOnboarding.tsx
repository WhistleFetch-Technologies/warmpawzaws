'use client';

import { useState } from 'react';
import { Building2, MapPin, Phone } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface IndependentVendorOnboardingProps {
  onSubmit?: (data: any) => void;
  onBack?: () => void;
}

export function IndependentVendorOnboarding({ onSubmit, onBack }: IndependentVendorOnboardingProps) {
  const [vendorName, setVendorName] = useState('');
  const [vendorType, setVendorType] = useState<'ambulance' | 'pharmacy' | 'diagnostics'>('pharmacy');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await apiClient.post<any>('/integrated-services/vendor/onboard-independent', {
        vendorName,
        vendorType,
        location: { lat: 0, lng: 0, address },
        contactInfo: { phone, email: '' },
      });

      if (response.success) {
        setSuccess(true);
        if (onSubmit) {
          onSubmit(response);
        }
      } else {
        setError(response.error || 'Failed to submit application');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-green-50 flex items-center justify-center max-w-[430px] mx-auto p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center w-full">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Onboarding Submitted!</h2>
          <p className="text-gray-600">Your application is under review</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Independent Vendor Onboarding</h2>
          <p className="text-gray-600 text-sm">Register your integrated service</p>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Name *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={vendorName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVendorName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
                placeholder="Enter vendor name"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Type *
            </label>
            <select
              value={vendorType}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setVendorType(e.target.value as any)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
            >
              <option value="ambulance">Ambulance</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="diagnostics">Diagnostics Center</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <textarea
                value={address}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setAddress(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none resize-none"
                rows={3}
                placeholder="Enter complete address"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Phone Number *
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:border-primary focus:ring-2 focus:ring-primary outline-none"
                placeholder="9876543210"
                maxLength={10}
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="flex-1 py-3 px-4 border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
            )}
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
