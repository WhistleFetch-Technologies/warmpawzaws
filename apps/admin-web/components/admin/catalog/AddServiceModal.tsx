'use client';

import { X, Package } from 'lucide-react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { useTaxCategories } from '@/hooks/useTaxCategories';
import { useHSNCodes } from '@/hooks/useHSNCodes';
import { EnhancedModal } from '../shared/EnhancedModal';
import { EnhancedButton } from '../shared/EnhancedButton';

/** Map display names / variants to canonical role codes for API (must match backend specialization_master ROLE_DISPLAY_TO_CODE) */
const ROLE_DISPLAY_TO_CODE: Record<string, string> = {
  'pet sitter': 'sitter', sitter: 'sitter', pet_sitter: 'sitter',
  'pet walker': 'walker', walker: 'walker', pet_walker: 'walker',
  'pet resort': 'resort', resort: 'resort', pet_resort: 'resort',
  'sunset care': 'sunset', sunset: 'sunset', pet_sunset_services: 'sunset',
  'trainer (center)': 'trainer_center', trainer_center: 'trainer_center',
  'trainer (solo)': 'trainer_solo', trainer_solo: 'trainer_solo',
  'veterinarian (solo)': 'vet_solo', vet_solo: 'vet_solo',
  'veterinary clinic': 'vet_clinic', vet_clinic: 'vet_clinic',
  'veterinarian': 'vet_solo', vet: 'vet_solo',
  boarding: 'boarding', pet_boarder: 'pet_boarder', pet_daycare: 'pet_daycare',
  'pet boarding': 'pet_boarding', pet_boarding: 'pet_boarding',
  'pet boarding & daycare': 'pet_boarding_daycare', pet_boarding_daycare: 'pet_boarding_daycare',
  'groomer (center)': 'groomer_center', 'groomer (solo)': 'groomer_solo',
  groomer_center: 'groomer_center', groomer_solo: 'groomer_solo',
  'pet groomer': 'pet_groomer', pet_groomer: 'pet_groomer', 'grooming center': 'groomer_center',
  'nutritionist (center)': 'nutritionist_center', 'nutritionist (solo)': 'nutritionist',
  nutritionist_center: 'nutritionist_center', nutritionist: 'nutritionist',
  'pet nutritionist': 'pet_nutritionist', pet_nutritionist: 'pet_nutritionist',
  'pet nutritionist (center)': 'nutritionist_center',
  'pet nutritionist (solo)': 'nutritionist',
  pet_nutritionist_center: 'nutritionist_center',
  pet_nutritionist_solo: 'nutritionist',
  'diagnostics center': 'diagnostics_center', diagnostics_center: 'diagnostics_center',
  'diagnostic center': 'diagnostics_center', diagnostic_center: 'diagnostics_center',
  'diagnostics provider': 'diagnostics_provider', diagnostics_provider: 'diagnostics_provider',
  'diagnostics (solo)': 'diagnostics_solo', diagnostics_solo: 'diagnostics_solo',
  'behaviorist center': 'behaviorist_center', behaviorist_center: 'behaviorist_center',
  'behaviorist (solo)': 'behaviorist_solo', behaviorist_solo: 'behaviorist_solo',
  'pet behaviorist': 'pet_behaviorist', pet_behaviorist: 'pet_behaviorist',
  'e-commerce seller': 'ecommerce_seller', ecommerce_seller: 'ecommerce_seller',
  'event organizer': 'event_organizer', event_organizer: 'event_organizer',
  'pet adoption center': 'adoption_center', adoption_center: 'adoption_center',
  pet_adoption_center: 'adoption_center',
};
function toCanonicalRoleCode(v: string): string {
  const raw = (v || '').toString().trim();
  const withSpace = raw.toLowerCase().replace(/\s+/g, ' ');
  const withUnderscore = raw.toLowerCase().replace(/\s+/g, '_');
  return ROLE_DISPLAY_TO_CODE[withSpace] ?? ROLE_DISPLAY_TO_CODE[withUnderscore] ?? ROLE_DISPLAY_TO_CODE[raw] ?? withUnderscore;
}

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
  taxCategoryId?: string;
  hsnCodeId?: string;
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
  const specLoadIdRef = useRef(0);
  const { taxCategories } = useTaxCategories({ isActive: true });
  const { hsnCodes } = useHSNCodes({ isActive: true });
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
    taxCategoryId: '' as string,
    hsnCodeId: '' as string,
  });
  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      loadRoles();
      
      if (service) {
        const specIds = (service as any).specializationIds ?? (service as any).specialization_ids ?? [];
        const rawRoles = (service.applicableRoles || []).map((r: string) => toCanonicalRoleCode(r));
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
          applicableRoles: [...new Set(rawRoles.filter(Boolean))],
          specializationIds: Array.isArray(specIds) ? specIds : [],
          taxCategoryId: (service as any).taxCategoryId ?? (service as any).tax_category_id ?? '',
          hsnCodeId: (service as any).hsnCodeId ?? (service as any).hsn_code_id ?? '',
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
          taxCategoryId: '',
          hsnCodeId: '',
        });
      }
    }
  }, [isOpen, categoryId, subCategoryId, service]);

  // Resolve category to slug for API (specialization_master uses slugs; admin may send service_categories.id UUID)
  const getCategorySlugForSpec = useCallback((categoryIdVal: string) => {
    if (!categoryIdVal) return '';
    const c = categories.find((cat: any) => (cat.id && String(cat.id) === String(categoryIdVal)) || (cat.category_id && String(cat.category_id) === String(categoryIdVal)));
    return (c?.category_id || c?.id || categoryIdVal) as string;
  }, [categories]);

  // Load specializations - extracted so we can call directly on role change (guarantees dynamic update).
  // Use request id so only the latest response updates state when user changes roles quickly.
  const loadSpecializations = useCallback((categoryIdVal: string, rolesArr: string[]) => {
    const hasCategory = !!categoryIdVal;
    const hasRoles = rolesArr.length > 0;
    if (!hasCategory && !hasRoles) {
      setSpecializationsByCategory([]);
      return;
    }
    const canonRoles = rolesArr.map(toCanonicalRoleCode).filter(Boolean);
    const roleIdsParam = canonRoles.length > 0 ? `roleIds=${encodeURIComponent(canonRoles.join(','))}` : '';
    const categorySlug = getCategorySlugForSpec(categoryIdVal) || categoryIdVal;
    const categoryParam = hasCategory ? `categoryId=${encodeURIComponent(categorySlug)}` : '';
    const params = [categoryParam, roleIdsParam].filter(Boolean).join('&');
    const query = `/admin/specializations?${params}`;
    const reqId = ++specLoadIdRef.current;
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[AddServiceModal] Loading specializations', { categoryIdVal, categorySlug, canonRoles, query });
    }
    setLoadingSpecializations(true);
    apiClient
      .get<any>(query)
      .then((data) => {
        if (reqId !== specLoadIdRef.current) return;
        const list = (data.specializations ?? data.data ?? []).map((s: any) => ({
          specializationId: s.specializationId ?? s.specialization_id,
          name: s.name ?? '',
          displayName: s.displayName ?? s.display_name ?? s.name ?? '',
        }));
        setSpecializationsByCategory(list);
        setFormData((prev) => {
          const validIds = new Set(list.map((s: { specializationId: string }) => s.specializationId));
          const kept = (prev.specializationIds || []).filter((id) => validIds.has(id));
          return kept.length === (prev.specializationIds?.length ?? 0) ? prev : { ...prev, specializationIds: kept };
        });
      })
      .catch((err) => {
        if (reqId !== specLoadIdRef.current) return;
        if (typeof window !== 'undefined') console.warn('[AddServiceModal] Specializations API failed', query, err);
        setSpecializationsByCategory([]);
      })
      .finally(() => {
        if (reqId === specLoadIdRef.current) setLoadingSpecializations(false);
      });
  }, [getCategorySlugForSpec]);

  // Trigger load when category or roles change
  useEffect(() => {
    if (!isOpen) return;
    loadSpecializations(formData.categoryId || '', formData.applicableRoles);
  }, [isOpen, formData.categoryId, JSON.stringify(formData.applicableRoles), loadSpecializations]);

  const effectiveHandleChange = (field: string, value: any) => {
    handleChange(field, value);
    if (field === 'applicableRoles') {
      // Immediately fetch with new roles - use ref to avoid stale closure
      const cat = formDataRef.current.categoryId || '';
      loadSpecializations(cat, Array.isArray(value) ? value : []);
    }
  };

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
      const activeRoles = Array.isArray(allRoles)
        ? allRoles.filter((r: any) => r.isActive !== false && r.is_active !== false)
        : [];
      setRoles(activeRoles);
    } catch (error) {
      console.error('Error loading roles:', error);
    }
  };

  /** Get canonical role code for API */
  const getRoleCode = (role: any) => toCanonicalRoleCode((role?.roleCode ?? role?.name ?? '').toString().trim());
  /** Check if role is selected (selected array stores canonical codes) */
  const isRoleSelected = (role: any, selected: string[]) => selected.includes(getRoleCode(role));

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
          tax_category_id: formData.taxCategoryId || undefined,
          hsn_code_id: formData.hsnCodeId || undefined,
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
        taxCategoryId: '',
        hsnCodeId: '',
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
                <optgroup label="Minutes">
                  <option value="15">15 minutes</option>
                  <option value="30">30 minutes</option>
                  <option value="45">45 minutes</option>
                </optgroup>
                <optgroup label="Hours">
                  <option value="60">1 hour</option>
                  <option value="90">1.5 hours</option>
                  <option value="120">2 hours</option>
                  <option value="240">4 hours</option>
                  <option value="480">8 hours</option>
                  <option value="720">12 hours</option>
                  <option value="1440">24 hours</option>
                </optgroup>
                <optgroup label="Days (nightly / multi-day)">
                  <option value="2880">2 days</option>
                  <option value="4320">3 days</option>
                  <option value="5760">4 days</option>
                  <option value="7200">5 days</option>
                  <option value="8640">6 days</option>
                  <option value="10080">7 days</option>
                </optgroup>
              </select>
              <p className="text-xs text-gray-500 mt-1">Stored in minutes (e.g. 24h = 1440, 2 days = 2880)</p>
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
                      Tax Category
                    </label>
                    <select
                      value={formData.taxCategoryId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('taxCategoryId', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
                    >
                      <option value="">— Select —</option>
                      {taxCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.category_name ?? c.id}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">From GST Configuration</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      HSN Code
                    </label>
                    <select
                      value={formData.hsnCodeId}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('hsnCodeId', e.target.value)}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#FF8C42] focus:border-[#FF8C42] transition-colors bg-white"
                    >
                      <option value="">— Select —</option>
                      {hsnCodes.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.hsn_code} — {h.description || h.gst_rate + '%'}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Overrides Tax Category rate when set</p>
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
              Applicable Roles <span className="text-red-500">*</span>
            </label>
            <div className="border border-gray-300 rounded-lg p-4 max-h-48 overflow-y-auto bg-gray-50">
              {roles.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Loading roles...</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {roles.map(role => {
                    const roleCode = getRoleCode(role);
                    const selected = isRoleSelected(role, formData.applicableRoles);
                    const equivToRemove: Record<string, string[]> = {
                      sitter: ['sitter', 'pet_sitter'],
                      pet_sitter: ['sitter', 'pet_sitter'],
                      walker: ['walker', 'pet_walker'],
                      pet_walker: ['walker', 'pet_walker'],
                      resort: ['resort', 'pet_resort'],
                      pet_resort: ['resort', 'pet_resort'],
                      groomer_center: ['groomer_center', 'pet_groomer', 'groomer_solo', 'groomer'],
                      groomer_solo: ['groomer_solo', 'pet_groomer', 'groomer_center', 'groomer'],
                      pet_groomer: ['pet_groomer', 'groomer_center', 'groomer_solo', 'groomer'],
                      nutritionist_center: ['nutritionist_center', 'nutritionist', 'pet_nutritionist'],
                      nutritionist: ['nutritionist', 'nutritionist_center', 'pet_nutritionist'],
                      pet_nutritionist: ['pet_nutritionist', 'nutritionist', 'nutritionist_center'],
                      diagnostics_center: ['diagnostics_center', 'diagnostic_center', 'diagnostics_provider', 'diagnostics_solo'],
                      diagnostic_center: ['diagnostics_center', 'diagnostic_center'],
                      behaviorist_center: ['behaviorist_center', 'behaviorist_solo', 'pet_behaviorist'],
                      behaviorist_solo: ['behaviorist_solo', 'behaviorist_center', 'pet_behaviorist'],
                      pet_behaviorist: ['pet_behaviorist', 'behaviorist_center', 'behaviorist_solo'],
                    };
                    return (
                      <label key={role.id} className="flex items-center gap-2 p-2 hover:bg-white rounded cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const canon = getRoleCode(role);
                            if (!canon) return;
                            const current = formData.applicableRoles;
                            if (e.target.checked) {
                              if (current.includes(canon)) return;
                              effectiveHandleChange('applicableRoles', [...current.filter((r) => toCanonicalRoleCode(r) !== canon), canon]);
                            } else {
                              const codes = equivToRemove[canon] || [canon];
                              const toRemove = new Set(codes.flatMap((c) => [c, toCanonicalRoleCode(c)]));
                              effectiveHandleChange('applicableRoles', current.filter((r) => !toRemove.has(r)));
                            }
                          }}
                          className="w-4 h-4 text-[#FF8C42] border-gray-300 rounded focus:ring-[#FF8C42]"
                        />
                        <span className="text-sm text-gray-700">{role.display_name || role.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Select roles that can use this service. Specializations below are filtered by these roles (from Catalog &gt; Categories).
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Specializations (optional)
            </label>
            <p className="text-xs text-gray-500 mb-2">Link this service to category specializations for vendor profile and problem-grid matching. From Catalog &gt; Categories, filtered by selected roles.</p>
            {!formData.categoryId && formData.applicableRoles.length === 0 ? (
              <p className="text-sm text-gray-400">Select applicable roles above (or a category) to load specializations.</p>
            ) : loadingSpecializations ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : specializationsByCategory.length === 0 ? (
              <p className="text-sm text-gray-500">No specializations for this category and selected roles.</p>
            ) : (
              <>
              {formData.applicableRoles.length === 0 && (
                <p className="text-xs text-amber-600 mb-2">Showing all specializations for this category. Select applicable roles above to filter.</p>
              )}
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
              </>
            )}
          </div>
        </div>
      </EnhancedModal>
  );
}

