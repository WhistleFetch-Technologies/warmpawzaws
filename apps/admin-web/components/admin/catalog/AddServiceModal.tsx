'use client';

import { X, Package } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface Service {
  id: string;
  name: string;
  category?: string;
  status?: 'active' | 'inactive' | 'draft' | 'pending';
  price: number;
  description?: string;
  categoryId?: string;
  subCategoryId?: string;
  serviceType?: string;
  duration?: number;
  applicableRoles?: string[];
}

interface AddServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  categoryId?: string;
  subCategoryId?: string;
  service?: Service | null;
}

export function AddServiceModal({
  isOpen,
  onClose,
  onSuccess,
  categoryId,
  subCategoryId,
  service
}: AddServiceModalProps) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    categoryId: categoryId || '',
    subCategoryId: subCategoryId || '',
    price: '',
    duration: '',
    serviceType: 'at-center' as 'at-home' | 'at-center' | 'tele' | 'delivery',
    status: 'active' as 'active' | 'inactive' | 'draft',
    applicableRoles: [] as string[]
  });

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadRoles();
      
      if (service) {
        // Populate form with service data for editing
        setFormData({
          name: service.name || '',
          code: '',
          description: service.description || '',
          categoryId: service.categoryId || categoryId || '',
          subCategoryId: service.subCategoryId || subCategoryId || '',
          price: String(service.price || ''),
          duration: service.duration ? String(service.duration) : '',
          serviceType: (service.serviceType === 'at_home' ? 'at-home' : 
                       service.serviceType === 'at_center' ? 'at-center' : 
                       service.serviceType || 'at-center') as 'at-home' | 'at-center' | 'tele' | 'delivery',
          status: (service.status && service.status !== 'pending' ? service.status : 'active') as 'active' | 'inactive' | 'draft',
          applicableRoles: service.applicableRoles || []
        });
      } else {
        // Reset form for new service
        setFormData({
          name: '',
          code: '',
          description: '',
          categoryId: categoryId || '',
          subCategoryId: subCategoryId || '',
          price: '',
          duration: '',
          serviceType: 'at-center',
          status: 'active',
          applicableRoles: []
        });
      }
    }
  }, [isOpen, categoryId, subCategoryId, service]);

  const loadCategories = async () => {
    try {
      const data = await apiClient.get<any>('/admin/catalog/categories');
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadRoles = async () => {
    try {
      const data = await apiClient.get<any>('/admin/roles');
      setRoles(data.roles || []);
    } catch (error) {
      console.error('Error loading roles:', error);
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

    if (formData.applicableRoles.length === 0) {
      const confirm = window.confirm('No roles selected. Service will not be visible to vendors. Continue anyway?');
      if (!confirm) return;
    }

    try {
      setLoading(true);
      
      if (service?.id) {
        // Update existing service
        await apiClient.put(`/admin/service-catalog/${service.id}`, {
          service_name: formData.name,
          display_name: formData.name,
          description: formData.description,
          category_id: formData.categoryId,
          sub_category_id: formData.subCategoryId,
          base_price: parseFloat(formData.price) || 0,
          duration_minutes: parseInt(formData.duration) || 30,
          service_style: formData.serviceType === 'at-home' ? 'at_home' : 
                        formData.serviceType === 'at-center' ? 'at_center' : 
                        formData.serviceType,
          status: formData.status,
          applicable_roles: formData.applicableRoles
        });
        alert('Service updated successfully!');
      } else {
        // Create new service
        await apiClient.post('/admin/catalog/services', {
          name: formData.name,
          code: formData.code,
          description: formData.description,
          categoryId: formData.categoryId,
          subCategoryId: formData.subCategoryId,
          price: formData.price,
          duration: formData.duration,
          serviceType: formData.serviceType,
          status: formData.status,
          applicableRoles: formData.applicableRoles
        });
        alert('Service created successfully!');
      }
      
      onSuccess?.();
      onClose();
      setFormData({
        name: '',
        code: '',
        description: '',
        categoryId: categoryId || '',
        subCategoryId: subCategoryId || '',
        price: '',
        duration: '',
        serviceType: 'at-center',
        status: 'active',
        applicableRoles: []
      });
    } catch (error: any) {
      console.error('Error saving service:', error);
      alert(error.message || `Failed to ${service?.id ? 'update' : 'create'} service. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-0 border-b sticky top-0 bg-white">
          <div className="flex items-center gap-0">
            <div className="p-0 bg-blue-100 rounded-lg">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">{service ? 'Edit Service' : 'Add Service'}</h3>
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
                placeholder="e.g., Daily Dog Walking"
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
                placeholder="e.g., WALK-001"
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
              placeholder="Service description..."
            />
          </div>

          {!categoryId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-0">
                Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('categoryId', e.target.value)}
                className="w-full px-0 py-0 border border-gray-300 rounded-lg text-sm"
              >
                <option value="">Select category</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

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
                placeholder="0.00"
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
                placeholder="e.g., 30 min"
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
                <option value="at-center">At Center</option>
                <option value="at-home">At Home</option>
                <option value="tele">Tele/Video</option>
                <option value="delivery">Delivery</option>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-0">
              Applicable Roles *
            </label>
            <div className="border border-gray-300 rounded-lg p-2 max-h-40 overflow-y-auto">
              {roles.length === 0 ? (
                <p className="text-sm text-gray-500">Loading roles...</p>
              ) : (
                roles.map(role => (
                  <label key={role.id} className="flex items-center gap-2 py-1">
                    <input
                      type="checkbox"
                      checked={formData.applicableRoles.includes(role.name || role.code)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const roleCode = role.name || role.code;
                        if (e.target.checked) {
                          handleChange('applicableRoles', [...formData.applicableRoles, roleCode]);
                        } else {
                          handleChange('applicableRoles', formData.applicableRoles.filter(r => r !== roleCode));
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-sm">{role.display_name || role.name}</span>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Select roles that can use this service. Leave empty to create an unassigned service.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-0 p-0 border-t">
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
            {loading ? (service ? 'Updating...' : 'Creating...') : (service ? 'Update Service' : 'Create Service')}
          </Button>
        </div>
      </div>
    </div>
  );
}

