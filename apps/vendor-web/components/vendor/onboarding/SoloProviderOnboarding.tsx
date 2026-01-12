'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { User, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import { StandardOnboardingFields } from '../StandardOnboardingFields';

interface SoloProviderOnboardingProps {
  roleId: string;
  onBack?: () => void;
  onSuccess?: () => void;
}

export function SoloProviderOnboarding({ roleId, onBack, onSuccess }: SoloProviderOnboardingProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    serviceArea: '',
    panNumber: '',
    aadharNumber: '',
    bankName: '',
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[fieldId];
        return newErrors;
      });
    }
  };

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.serviceArea.trim()) newErrors.serviceArea = 'Service area is required';
    if (!formData.panNumber.trim()) newErrors.panNumber = 'PAN number is required';
    if (!formData.aadharNumber.trim()) newErrors.aadharNumber = 'Aadhar number is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setLoading(true);
      
      // ✅ FIX: Use correct endpoint - /vendor/onboarding/submit-application
      // Get phone from localStorage if not in formData
      const phone = formData.phone || (typeof window !== 'undefined' ? localStorage.getItem('vendorPhone') : null);
      
      if (!phone) {
        alert('Phone number is required. Please log in again.');
        return;
      }

      // ✅ FIX: Use correct endpoint and payload structure
      const response = await apiClient.post<any>('/vendor/onboarding/submit-application', {
        phone: phone,
        application_payload: {
          ...formData,
          roleId,
          vendor_type: 'solo', // Solo provider type
        },
        uploaded_documents: [], // Documents can be added later if needed
      });

      if (response.success || response.applicationId) {
        if (onSuccess) onSuccess();
      } else {
        alert(response.error || 'Failed to submit application');
      }
    } catch (error: any) {
      console.error('Error submitting application:', error);
      alert(error?.message || 'Error submitting application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 px-4 py-4">
        {onBack && (
          <button onClick={onBack} className="mb-0 text-gray-600 hover:text-gray-900 flex items-center gap-0">
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        )}
        <div className="flex items-center gap-0">
          <div className="p-0 bg-orange-100 rounded-lg">
            <User className="w-6 h-6 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Solo Provider Onboarding</h1>
            <p className="text-sm text-gray-500">Quick setup for independent providers</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Your Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('name', e.target.value)}
            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="Enter your full name"
          />
          {errors.name && <p className="text-xs text-red-500 mt-0">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Phone Number *
          </label>
          <input
            type="tel"
            value={formData.phone}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('phone', e.target.value)}
            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="Enter phone number"
          />
          {errors.phone && <p className="text-xs text-red-500 mt-0">{errors.phone}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('email', e.target.value)}
            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="Enter email (optional)"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0">
            Service Area *
          </label>
          <input
            type="text"
            value={formData.serviceArea}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('serviceArea', e.target.value)}
            className="w-full px-0 py-0 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500"
            placeholder="e.g., South Delhi, Gurgaon"
          />
          <p className="text-xs text-gray-500 mt-0">Areas where you provide services</p>
          {errors.serviceArea && <p className="text-xs text-red-500 mt-0">{errors.serviceArea}</p>}
        </div>

        <StandardOnboardingFields
          formData={formData}
          errors={errors}
          onFieldChange={handleFieldChange}
        />

        <button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full py-0 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium flex items-center justify-center gap-0 disabled:opacity-50"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Submit Application
            </>
          )}
        </button>
      </div>
    </div>
  );
}

