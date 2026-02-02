'use client';

import { X, Package } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { EnhancedModal } from '../shared/EnhancedModal';
import { EnhancedButton } from '../shared/EnhancedButton';

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
  specializationIds?: string[];
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
  const [specializationsByCategory, setSpecializationsByCategory] = useState<{ specializationId: string; name: string; displayName: string }[]>([]);
  const [loadingSpecializations, setLoadingSpecializations] = useState(false);
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
    applicableRoles: [] as string[],
    specializationIds: [] as string[],
  });

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadRoles();
      
      if (service) {
        const specIds = (service as any).specializationIds ?? (service as any).specialization_ids ?? [];
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
          applicableRoles: service.applicableRoles || [],
          specializationIds: Array.isArray(specIds) ? specIds : [],
        });
      } else {
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
          applicableRoles: [],
          specializationIds: [],
        });
      }
    }
  }, [isOpen, categoryId, subCategoryId, service]);

  // Load specializations when category changes
  useEffect(() => {
    if (!formData.categoryId) {
      setSpecializationsByCategory([]);
      return;
    }
    let cancelled = false;
    setLoadingSpecializations(true);
    apiClient
      .get<any>(`/admin/specializations?categoryId=${encodeURIComponent(formData.categoryId)}`)
      .then((data) => {
        if (cancelled) return;
        const list = (data.specializations ?? data.data ?? []).map((s: any) => ({
          specializationId: s.specializationId ?? s.specialization_id,
          name: s.name ?? '',
          displayName: s.displayName ?? s.display_name ?? s.name ?? '',
        }));
        setSpecializationsByCategory(list);
      })
      .catch(() => {
        if (!cancelled) setSpecializationsByCategory([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSpecializations(false);
      });
    return () => { cancelled = true; };
  }, [formData.categoryId]);

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
      const allRoles = data.roles || data?.data || [];
      // ✅ FIX: Filter to active roles only (canonical roles post-migration)
      const activeRoles = Array.isArray(allRoles) 
        ? allRoles.filter((r: any) => r.isActive !== false && r.is_active !== false)
        : [];
      setRoles(activeRoles);
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
          applicable_roles: formData.applicableRoles,
          specialization_ids: formData.specializationIds,
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
          applicableRoles: formData.applicableRoles,
          specializationIds: formData.specializationIds,
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
        applicableRoles: [],
        specializationIds: [],
      });
    } catch (error: any) {
      console.error('Error saving service:', error);
      alert(error.message || `Failed to ${service?.id ? 'update' : 'create'} service. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <EnhancedModal
      isOpen={isOpen}
      onClose={onClose}
      title={service ? 'Edit Service' : 'Create New Service'}
      subtitle={service ? 'Update service details and configuration' : 'Add a new service to the selected category and subcategory'}
      icon={<Package className="w-5 h-5 text-white" />}
      maxWidth="lg"
      footer={
        <div className="flex items-center justify-end gap-3">
          <EnhancedButton
            variant="outline"
            onClick={onClose}
            disabled={loading}
            icon={X}
            iconPosition="left"
          >
            Cancel
          </EnhancedButton>
          <EnhancedButton
            variant="primary"
            onClick={handleSubmit}
            disabled={loading}
            loading={loading}
          >
            {service ? 'Update Service' : 'Add Service'}
          </EnhancedButton>
        </div>
      }
    >
      <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
                placeholder="eg, Dental health care"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Code
              </label>
              <input
                type="text"
                value={formData.code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('code', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
                placeholder="eg, VET-001"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('description', e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors resize-none"
              rows={4}
              placeholder="Describe your service in detail...."
            />
          </div>

          {!categoryId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Parent Category
              </label>
              <select
                value={formData.categoryId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('categoryId', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Base Price <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('price', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Duration
              </label>
              <select
                value={formData.duration}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('duration', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
              >
                <option value="">Select duration</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="45">45 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1.5 hours</option>
                <option value="120">2 hours</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Type
              </label>
              <select
                value={formData.serviceType}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('serviceType', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
              >
                <option value="at-center">At Center</option>
                <option value="at-home">At Home</option>
                <option value="tele">Tele/Video</option>
                <option value="delivery">Delivery</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('status', e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          {/* GST & Tax Configuration Section */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="p-1.5 bg-yellow-100 rounded">
                <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">GST & Tax Configuration</h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GST Inclusion <span className="text-red-500">*</span>
                    </label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white">
                      <option value="">Select GST option</option>
                      <option value="inclusive">Inclusive</option>
                      <option value="exclusive">Exclusive</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GST Rate (%)
                    </label>
                    <select className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white">
                      <option value="">Select GST rate</option>
                      <option value="0">0%</option>
                      <option value="5">5%</option>
                      <option value="12">12%</option>
                      <option value="18">18%</option>
                      <option value="28">28%</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="show-final-price"
                    className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                  />
                  <label htmlFor="show-final-price" className="text-sm text-gray-700">
                    Show final price to customers (including all taxes)
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specializations (optional)
            </label>
            <p className="text-xs text-gray-500 mb-2">Link this service to category specializations for vendor profile and problem-grid matching.</p>
            {!formData.categoryId ? (
              <p className="text-sm text-gray-400">Select a category first to load specializations.</p>
            ) : loadingSpecializations ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : specializationsByCategory.length === 0 ? (
              <p className="text-sm text-gray-500">No specializations for this category.</p>
            ) : (
              <div className="border border-gray-300 rounded-lg p-4 max-h-40 overflow-y-auto bg-gray-50 flex flex-wrap gap-2">
                {specializationsByCategory.map((spec) => {
                  const selected = formData.specializationIds.includes(spec.specializationId);
                  return (
                    <label key={spec.specializationId} className="flex items-center gap-2 px-3 py-1.5 rounded-full border cursor-pointer transition-colors bg-white border-gray-200 hover:border-gray-300">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          if (e.target.checked) {
                            handleChange('specializationIds', [...formData.specializationIds, spec.specializationId]);
                          } else {
                            handleChange('specializationIds', formData.specializationIds.filter((id) => id !== spec.specializationId));
                          }
                        }}
                        className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                      />
                      <span className="text-sm text-gray-700">{spec.displayName || spec.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Applicable Roles <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
              {roles.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading roles...</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {roles.map(role => (
                    <label key={role.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors">
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
                        className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                      />
                      <span className="text-sm text-gray-700">{role.display_name || role.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Select roles that can use this service. Leave empty to create an unassigned service.
            </p>
          </div>
        </div>
      </EnhancedModal>
  );
}

