'use client';

import { X, Grid3x3 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { IconSelector } from './IconSelector';

interface AddCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddCategoryModal({
  isOpen,
  onClose,
  onSuccess
}: AddCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📦',
    status: 'active' as 'active' | 'inactive',
    vendorType: '',
    serviceStyle: ''
  });

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!formData.name) {
      alert('Please enter a category name');
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/admin/catalog/categories', formData);
      alert('Category created successfully!');
      onSuccess?.();
      onClose();
      setFormData({
        name: '',
        description: '',
        icon: '📦',
        status: 'active',
        vendorType: '',
        serviceStyle: ''
      });
    } catch (error) {
      console.error('Error creating category:', error);
      alert('Failed to create category. Please try again.');
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
              <Grid3x3 className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Add Category</h3>
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
                Category Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Veterinary Services"
              />
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
              </select>
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
              placeholder="Category description..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Icon
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowIconSelector(!showIconSelector)}
                className="px-4 py-0 border border-gray-300 rounded-lg text-2xl hover:bg-gray-50"
              >
                {formData.icon}
              </button>
              {showIconSelector && (
                <div className="absolute z-10">
                  <IconSelector
                    value={formData.icon}
                    onChange={(icon) => {
                      handleChange('icon', icon);
                      setShowIconSelector(false);
                    }}
                    onClose={() => setShowIconSelector(false)}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Vendor Type
              </label>
              <input
                type="text"
                value={formData.vendorType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('vendorType', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., Professional"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Service Style
              </label>
              <input
                type="text"
                value={formData.serviceStyle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('serviceStyle', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
                placeholder="e.g., At Home"
              />
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
            className="bg-primary hover:bg-primary/90"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Creating...' : 'Create Category'}
          </Button>
        </div>
      </div>
    </div>
  );
}

