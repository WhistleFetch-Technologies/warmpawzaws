'use client';

import { X, Package } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface EditServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  serviceId: string;
  initialData?: any;
}

export function EditServiceModal({
  isOpen,
  onClose,
  onSuccess,
  serviceId,
  initialData
}: EditServiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    price: '',
    duration: '',
    serviceType: 'at-home' as 'at-home' | 'at-center',
    status: 'active' as 'active' | 'inactive' | 'draft'
  });

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name || '',
        code: initialData.code || '',
        description: initialData.description || '',
        price: initialData.price?.toString() || '',
        duration: initialData.duration || '',
        serviceType: initialData.serviceType || 'at-home',
        status: initialData.status || 'active'
      });
    } else if (isOpen && serviceId) {
      loadService();
    }
  }, [isOpen, serviceId, initialData]);

  const loadService = async () => {
    try {
      const data = await apiClient.get<any>(`/admin/catalog/services/${serviceId}`);
      if (data.service) {
        setFormData({
          name: data.service.name || '',
          code: data.service.code || '',
          description: data.service.description || '',
          price: data.service.price?.toString() || '',
          duration: data.service.duration || '',
          serviceType: data.service.serviceType || 'at-home',
          status: data.service.status || 'active'
        });
      }
    } catch (error) {
      console.error('Error loading service:', error);
    }
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put(`/admin/catalog/services/${serviceId}`, formData);
      alert('Service updated successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating service:', error);
      alert('Failed to update service. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-0 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-3">
            <div className="p-0 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Edit Service</h3>
          </div>
          <button
            onClick={onClose}
            className="p-0 hover:bg-gray-100 rounded"
            disabled={loading}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-0 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Service Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Service Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('code', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
              className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Price (₹) *
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('price', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Duration
              </label>
              <input
                type="text"
                value={formData.duration}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('duration', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Service Type
              </label>
              <select
                value={formData.serviceType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('serviceType', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              >
                <option value="at-home">At Home</option>
                <option value="at-center">At Center</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('status', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-0 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Service'}
          </Button>
        </div>
      </div>
    </div>
  );
}

