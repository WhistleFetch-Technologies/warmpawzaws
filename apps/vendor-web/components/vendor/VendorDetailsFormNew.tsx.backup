'use client';

import React, { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Building2, MapPin, Phone, Mail, Save, Loader2 } from 'lucide-react';

interface VendorDetailsFormNewProps {
  vendorId?: string;
  initialData?: any;
  onSuccess?: () => void;
}

export function VendorDetailsFormNew({ vendorId, initialData, onSuccess }: VendorDetailsFormNewProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: initialData?.businessName || '',
    ownerName: initialData?.ownerName || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    gstNumber: initialData?.gstNumber || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, string> = {};
    if (!formData.businessName.trim()) newErrors.businessName = 'Business name is required';
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Owner name is required';
    if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setLoading(true);
      const endpoint = vendorId ? `/vendor/${vendorId}/details` : '/vendor/details';
      const method = vendorId ? 'put' : 'post';
      
      const response = await apiClient[method]<any>(endpoint, formData);

      if (response.success) {
        if (onSuccess) onSuccess();
        alert('Vendor details saved successfully!');
      } else {
        alert('Failed to save vendor details');
      }
    } catch (error) {
      console.error('Error saving vendor details:', error);
      alert('Error saving vendor details');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto p-4">
      <div className="bg-white rounded-lg border-2 border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Vendor Details</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              Business Name *
            </label>
            <input
              type="text"
              value={formData.businessName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('businessName', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter business name"
            />
            {errors.businessName && <p className="text-xs text-red-500 mt-1">{errors.businessName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Owner Name *
            </label>
            <input
              type="text"
              value={formData.ownerName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('ownerName', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter owner name"
            />
            {errors.ownerName && <p className="text-xs text-red-500 mt-1">{errors.ownerName}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Phone className="w-4 h-4 text-gray-400" />
              Phone Number *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('phone', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter phone number"
            />
            {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <Mail className="w-4 h-4 text-gray-400" />
              Email
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('email', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter email (optional)"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              Address *
            </label>
            <textarea
              value={formData.address}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('address', e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              rows={3}
              placeholder="Enter full address"
            />
            {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                City *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('city', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="City"
              />
              {errors.city && <p className="text-xs text-red-500 mt-1">{errors.city}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                State
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('state', e.target.value)}
                className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                placeholder="State"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pincode
            </label>
            <input
              type="text"
              value={formData.pincode}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('pincode', e.target.value.replace(/\D/g, ''))}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="Enter pincode"
              maxLength={6}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              GST Number
            </label>
            <input
              type="text"
              value={formData.gstNumber}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('gstNumber', e.target.value.toUpperCase())}
              className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 uppercase"
              placeholder="22AAAAA0000A1Z5"
              maxLength={15}
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
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Details
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

