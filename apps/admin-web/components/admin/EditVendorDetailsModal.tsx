'use client';

import { X, Loader2, CheckCircle, AlertCircle, Edit } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button, Input } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface EditVendorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendorId: string;
  vendorName: string;
  onUpdate?: () => void; // Optional callback to refresh vendor list
}

interface FormData {
  email: string;
  phone: string;
  business_name: string;
  owner_name: string;
  status: string;
  address: string;
}

const STATUS_OPTIONS = [
  { value: 'approved', label: 'Approved' },
  { value: 'pending', label: 'Pending' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'suspended', label: 'Suspended' },
];

export function EditVendorDetailsModal({
  isOpen,
  onClose,
  vendorId,
  vendorName,
  onUpdate
}: EditVendorDetailsModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    email: '',
    phone: '',
    business_name: '',
    owner_name: '',
    status: 'approved',
    address: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vendorId) {
      loadVendorDetails();
    } else {
      // Reset form when modal closes
      setFormData({
        email: '',
        phone: '',
        business_name: '',
        owner_name: '',
        status: 'approved',
        address: '',
      });
      setErrors({});
      setSuccess(null);
    }
  }, [isOpen, vendorId]);

  const loadVendorDetails = async () => {
    try {
      setLoading(true);
      setErrors({});
      setSuccess(null);
      
      const response = await apiClient.get<any>(`/admin/vendors/${vendorId}/details`);
      
      if (response.success && response.vendor) {
        const vendor = response.vendor;
        setFormData({
          email: vendor.email || '',
          phone: vendor.phone || '',
          business_name: vendor.businessName || vendor.name || '',
          owner_name: vendor.ownerName || '',
          status: vendor.status || 'approved',
          address: vendor.address || '',
        });
      } else {
        setErrors({ general: 'Failed to load vendor details' });
      }
    } catch (error: any) {
      console.error('Error loading vendor details:', error);
      setErrors({ general: error.message || 'Failed to load vendor details' });
    } finally {
      setLoading(false);
    }
  };

  const handleFieldChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    // Clear general error
    if (errors.general) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors.general;
        return newErrors;
      });
    }
    setSuccess(null);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Validate required fields
    if (!formData.business_name?.trim()) {
      newErrors.business_name = 'Business name is required';
    }

    if (!formData.phone?.trim()) {
      newErrors.phone = 'Phone number is required';
    }

    // Validate status
    if (!formData.status || !STATUS_OPTIONS.find(opt => opt.value === formData.status)) {
      newErrors.status = 'Please select a valid status';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      setSaving(true);
      setErrors({});
      setSuccess(null);

      // Prepare update payload - only include fields that have values
      // Note: 'name' is not a column in vendors table, only business_name and owner_name exist
      const updatePayload: Partial<Omit<FormData, 'name'>> = {};
      
      if (formData.email) updatePayload.email = formData.email;
      if (formData.phone) updatePayload.phone = formData.phone;
      if (formData.business_name) updatePayload.business_name = formData.business_name;
      if (formData.owner_name) updatePayload.owner_name = formData.owner_name;
      if (formData.status) updatePayload.status = formData.status;
      if (formData.address) updatePayload.address = formData.address;

      const response = await apiClient.post<any>(
        `/admin/update-vendor-profile/${vendorId}`,
        updatePayload
      );

      if (response.success) {
        setSuccess('Vendor details updated successfully');
        
        // Call onUpdate callback if provided to refresh the list
        if (onUpdate) {
          setTimeout(() => {
            onUpdate();
          }, 500);
        }

        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrors({ general: response.error || 'Failed to update vendor details' });
      }
    } catch (error: any) {
      console.error('Error updating vendor details:', error);
      setErrors({ general: error.message || 'Failed to update vendor details' });
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit Vendor Details
            </h2>
            <p className="text-sm text-gray-500 mt-1">{vendorName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            disabled={saving}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
            </div>
          ) : (
            <>
              {errors.general && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                  <span className="text-red-700">{errors.general}</span>
                </div>
              )}

              {success && (
                <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <span className="text-green-700">{success}</span>
                </div>
              )}

              <div className="space-y-4">
                {/* Business Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.business_name}
                    onChange={(e) => handleFieldChange('business_name', e.target.value)}
                    placeholder="Enter business name"
                    className={errors.business_name ? 'border-red-300' : ''}
                    disabled={saving}
                  />
                  {errors.business_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.business_name}</p>
                  )}
                </div>

                {/* Owner Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Owner Name
                  </label>
                  <Input
                    type="text"
                    value={formData.owner_name}
                    onChange={(e) => handleFieldChange('owner_name', e.target.value)}
                    placeholder="Enter owner name"
                    className={errors.owner_name ? 'border-red-300' : ''}
                    disabled={saving}
                  />
                  {errors.owner_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.owner_name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleFieldChange('email', e.target.value)}
                    placeholder="Enter email address"
                    className={errors.email ? 'border-red-300' : ''}
                    disabled={saving}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                  )}
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="Enter phone number"
                    className={errors.phone ? 'border-red-300' : ''}
                    disabled={saving}
                  />
                  {errors.phone && (
                    <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                  )}
                </div>

                {/* Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleFieldChange('status', e.target.value)}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent ${
                      errors.status ? 'border-red-300' : 'border-gray-300'
                    } ${saving ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    disabled={saving}
                  >
                    {STATUS_OPTIONS.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {errors.status && (
                    <p className="mt-1 text-sm text-red-600">{errors.status}</p>
                  )}
                </div>

                {/* Address */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Address
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    placeholder="Enter business address"
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent resize-none ${
                      errors.address ? 'border-red-300' : 'border-gray-300'
                    } ${saving ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                    disabled={saving}
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address}</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button 
            variant="outline" 
            onClick={onClose} 
            disabled={saving || loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-[#FF8C42] hover:bg-[#FF7A2E] gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
