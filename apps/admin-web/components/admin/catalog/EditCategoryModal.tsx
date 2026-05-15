'use client';

import { X, Grid3x3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { IconSelector } from './IconSelector';

interface EditCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categoryId: string;
  initialData?: any;
}

export function EditCategoryModal({
  isOpen,
  onClose,
  onSuccess,
  categoryId,
  initialData
}: EditCategoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '📦',
    iconColor: 'text-gray-500',
    status: 'active' as 'active' | 'inactive',
    vendorType: '',
    serviceStyle: '',
    customerVisibilityType: 'GLOBAL' as 'GLOBAL' | 'STATE' | 'CITY',
    customerVisibilityState: '',
    customerVisibilityCity: '',
    customerDashboardCardActive: true,
  });

  useEffect(() => {
    if (isOpen && initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        icon: initialData.icon || '📦',
        iconColor: initialData.iconColor || initialData.icon_color || 'text-gray-500',
        status: initialData.status || 'active',
        vendorType: initialData.vendorType || '',
        serviceStyle: initialData.serviceStyle || '',
        customerVisibilityType: (initialData.customerVisibilityType as 'GLOBAL' | 'STATE' | 'CITY') || 'GLOBAL',
        customerVisibilityState: initialData.customerVisibilityState || '',
        customerVisibilityCity: initialData.customerVisibilityCity || '',
        customerDashboardCardActive: initialData.customerDashboardCardActive !== false,
      });
    } else if (isOpen && categoryId) {
      loadCategory();
    }
  }, [isOpen, categoryId, initialData]);

  const loadCategory = async () => {
    try {
      const data = await apiClient.get<any>(`/admin/catalog/categories/${categoryId}`);
      if (data.category) {
        const c = data.category;
        setFormData({
          name: c.name || '',
          description: c.description || '',
          icon: c.icon || '📦',
          iconColor: c.iconColor || c.icon_color || 'text-gray-500',
          status: (c.status as 'active' | 'inactive') || (c.is_active === false ? 'inactive' : 'active'),
          vendorType: c.vendorType || '',
          serviceStyle: c.serviceStyle || '',
          customerVisibilityType: (c.customerVisibilityType as 'GLOBAL' | 'STATE' | 'CITY') || 'GLOBAL',
          customerVisibilityState: c.customerVisibilityState || '',
          customerVisibilityCity: c.customerVisibilityCity || '',
          customerDashboardCardActive: c.customerDashboardCardActive !== false,
        });
      }
    } catch (error) {
      console.error('Error loading category:', error);
    }
  };

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
      await apiClient.put(`/admin/catalog/categories/${categoryId}`, {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        iconColor: formData.iconColor || 'text-gray-500',
        status: formData.status,
        customerVisibilityType: formData.customerVisibilityType,
        customerVisibilityState: formData.customerVisibilityState,
        customerVisibilityCity: formData.customerVisibilityCity,
        customerDashboardCardActive: formData.customerDashboardCardActive,
      });
      alert('Category updated successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Error updating category:', error);
      alert('Failed to update category. Please try again.');
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
            <h3 className="text-lg font-semibold text-gray-900">Edit Category</h3>
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
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Icon
            </label>
            <div className="flex items-center gap-3 relative">
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

          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-medium text-gray-800">Customer home tiles</p>
            <p className="text-xs text-gray-700 rounded-lg border border-blue-100 bg-blue-50 p-3">
              Visibility by location is set in <strong>Marketing &amp; Promotions → Dashboard UI</strong> (Geographic Scope and Service Launch Status), not here. The customer still sees this category name on the tile when the service is launched for their area.
            </p>
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
            className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? 'Updating...' : 'Update Category'}
          </Button>
        </div>
      </div>
    </div>
  );
}

