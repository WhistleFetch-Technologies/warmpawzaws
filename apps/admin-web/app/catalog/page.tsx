'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { HierarchicalServiceList } from '@/components/admin/catalog/HierarchicalServiceList';
import { CategoriesTab } from '@/components/admin/catalog/CategoriesTab';
import { ServiceCatalogTab } from '@/components/admin/catalog/ServiceCatalogTab';
import { VendorRolesTab } from '@/components/admin/catalog/VendorRolesTab';
// AdminRolesPage removed - use /roles page instead
import { OnboardingDesigner } from '@/components/admin/onboarding/OnboardingDesigner';

// ============================================================================
// TYPES
// ============================================================================

interface ServiceCatalogItem {
  id: string;
  service_id: string;
  service_name: string;
  display_name: string;
  description: string;
  category_id: string;
  category_name: string;
  sub_category_id?: string;
  sub_category_name?: string;
  applicable_roles: string[];
  specialization_ids?: string[];
  service_style: 'centre' | 'home' | 'tele' | 'ecommerce' | 'all' | 'at_center' | 'at_home';
  base_price: number;
  duration_minutes: number;
  status: 'active' | 'inactive' | 'draft' | 'archived';
  publish_status: 'published' | 'unpublished' | 'archived';
  display_order: number;
  icon_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface Category {
  id: string;
  name: string;
  display_name: string;
  category_id?: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ServiceCatalogPage() {
  const [activeTab, setActiveTab] = useState<'categories' | 'roles' | 'onboarding' | 'servicecatalog'>('categories');
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Stats
  const [stats, setStats] = useState<{
    mainCategories: { count: number; change: number };
    activeProducts: { count: number; change: number };
    pendingReviews: { count: number; change: number };
    lowStockAlerts: { count: number; change: number };
  } | null>(null);
  
  // Filters
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterStyle, setFilterStyle] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingService, setEditingService] = useState<ServiceCatalogItem | null>(null);
  const [formData, setFormData] = useState<Partial<ServiceCatalogItem>>({});
  const [saving, setSaving] = useState(false);
  const [specializationsByCategory, setSpecializationsByCategory] = useState<{ specializationId: string; name: string; displayName: string }[]>([]);
  const [loadingSpecializations, setLoadingSpecializations] = useState(false);

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [servicesRes, categoriesRes, statsRes] = await Promise.all([
        apiClient.get<any>('/admin/service-catalog?groupBy=subcategory'),
        apiClient.get<any>('/service-catalog/categories'),
        apiClient.get<any>('/admin/catalog/stats'),
      ]);
      
      // Handle grouped services response - ensure all fields are safe
      if (servicesRes.grouped && Array.isArray(servicesRes.services)) {
        // Flatten grouped structure for compatibility
        const allServices: ServiceCatalogItem[] = [];
        servicesRes.services.forEach((cat: any) => {
          if (cat.subcategories && Array.isArray(cat.subcategories)) {
            cat.subcategories.forEach((subcat: any) => {
              if (subcat.services && Array.isArray(subcat.services)) {
                allServices.push(...subcat.services.map((s: any) => ({
                  ...s,
                  id: String(s.id || s.service_id || ''),
                  service_id: String(s.service_id || s.id || ''),
                  service_name: String(s.service_name || ''),
                  display_name: String(s.display_name || s.service_name || ''),
                  category_id: String(s.category_id || ''),
                  category_name: String(s.category_name || ''),
                  sub_category_id: String(s.sub_category_id || ''),
                  sub_category_name: String(s.sub_category_name || ''),
                  description: String(s.description || ''),
                })));
              }
            });
          }
          if (cat.services && Array.isArray(cat.services)) {
            allServices.push(...cat.services.map((s: any) => ({
              ...s,
              id: String(s.id || s.service_id || ''),
              service_id: String(s.service_id || s.id || ''),
              service_name: String(s.service_name || ''),
              display_name: String(s.display_name || s.service_name || ''),
              category_id: String(s.category_id || ''),
              category_name: String(s.category_name || ''),
              sub_category_id: String(s.sub_category_id || ''),
              sub_category_name: String(s.sub_category_name || ''),
              description: String(s.description || ''),
            })));
          }
        });
        setServices(allServices);
      } else {
        const safeServices = (servicesRes.services || servicesRes || []).map((s: any) => ({
          ...s,
          id: String(s.id || s.service_id || ''),
          service_id: String(s.service_id || s.id || ''),
          service_name: String(s.service_name || ''),
          display_name: String(s.display_name || s.service_name || ''),
          category_id: String(s.category_id || ''),
          category_name: String(s.category_name || ''),
          sub_category_id: String(s.sub_category_id || ''),
          sub_category_name: String(s.sub_category_name || ''),
          description: String(s.description || ''),
        }));
        setServices(safeServices);
      }
      
      // Ensure categories are safe
      const safeCategories = (categoriesRes.categories || categoriesRes || []).map((cat: any) => ({
        id: String(cat.id || ''),
        name: String(cat.name || ''),
        display_name: String(cat.display_name || cat.name || ''),
        category_id: String(cat.category_id || ''),
        description: String(cat.description || ''),
      }));
      setCategories(safeCategories);
      
      if (statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (err: any) {
      console.error('Error loading catalog:', err);
      setError(err.message || 'Failed to load service catalog');
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCreate = () => {
    setEditingService(null);
    setFormData({
      service_name: '',
      display_name: '',
      description: '',
      category_id: '',
      applicable_roles: [],
      specialization_ids: [],
      service_style: 'centre',
      base_price: 0,
      duration_minutes: 30,
      status: 'active',
      publish_status: 'published',
      display_order: services.length + 1,
    });
    setShowModal(true);
  };

  const handleEdit = (service: ServiceCatalogItem) => {
    setEditingService(service);
    const normRoles = (service.applicable_roles || []).map((r: string) => toCanonicalRoleCode(r)).filter(Boolean);
    setFormData({
      service_name: service.service_name,
      display_name: service.display_name,
      description: service.description,
      category_id: service.category_id,
      applicable_roles: [...new Set(normRoles)],
      specialization_ids: service.specialization_ids ?? [],
      service_style: service.service_style,
      base_price: service.base_price,
      duration_minutes: service.duration_minutes,
      status: service.status,
      publish_status: service.publish_status,
      display_order: service.display_order,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      
      if (editingService) {
        await apiClient.put(`/admin/service-catalog/${editingService.id}`, formData);
        setSuccess('Service updated successfully');
      } else {
        const categoryName = categories.find(c => c.id === formData.category_id)?.display_name || categories.find(c => c.id === formData.category_id)?.name || formData.category_id || '';
        const serviceId = formData.service_id || (formData.service_name || '').replace(/\s+/g, '_').toLowerCase().replace(/[^a-z0-9_]/g, '') || `svc_${Date.now()}`;
        await apiClient.post('/admin/service-catalog', {
          ...formData,
          service_id: serviceId,
          service_name: formData.service_name || formData.display_name || '',
          display_name: formData.display_name || formData.service_name || '',
          category_name: categoryName,
          applicable_roles: formData.applicable_roles || [],
          specialization_ids: formData.specialization_ids || [],
        });
        setSuccess('Service created successfully');
      }
      
      setShowModal(false);
      setEditingService(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: ServiceCatalogItem) => {
    if (!confirm(`Are you sure you want to delete "${service.display_name}"?`)) return;
    
    try {
      await apiClient.delete(`/admin/service-catalog/${service.id}`);
      setSuccess('Service deleted successfully');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete service');
    }
  };

  const handleToggleStatus = async (service: ServiceCatalogItem) => {
    try {
      const newStatus = service.status === 'active' ? 'inactive' : 'active';
      await apiClient.put(`/admin/service-catalog/${service.id}`, { status: newStatus });
      setSuccess(`Service ${newStatus === 'active' ? 'activated' : 'deactivated'}`);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update service status');
    }
  };

  // Normalize role to canonical code for API (must match backend ROLE_EXPANSIONS / ROLE_DISPLAY_TO_CODE)
  const toCanonicalRoleCode = (v: string) => {
    const map: Record<string, string> = {
      'pet sitter': 'sitter', sitter: 'sitter', pet_sitter: 'sitter',
      'pet walker': 'walker', walker: 'walker', pet_walker: 'walker',
      'pet resort': 'resort', resort: 'resort', pet_resort: 'resort',
      'pet boarding': 'pet_boarding', pet_boarding: 'pet_boarding',
      'pet boarding & daycare': 'pet_boarding_daycare', pet_boarding_daycare: 'pet_boarding_daycare',
      'boarding': 'boarding', pet_boarder: 'pet_boarder', pet_daycare: 'pet_daycare',
      'sunset care': 'sunset', sunset: 'sunset',
      'trainer (center)': 'trainer_center', trainer_center: 'trainer_center',
      'trainer (solo)': 'trainer_solo', trainer_solo: 'trainer_solo',
      'veterinarian (solo)': 'vet_solo', vet_solo: 'vet_solo',
      'veterinary clinic': 'vet_clinic', vet_clinic: 'vet_clinic',
      'groomer (center)': 'groomer_center', 'groomer (solo)': 'groomer_solo', groomer_center: 'groomer_center', groomer_solo: 'groomer_solo', pet_groomer: 'pet_groomer',
      'nutritionist (center)': 'nutritionist_center', 'nutritionist (solo)': 'nutritionist', nutritionist_center: 'nutritionist_center', nutritionist: 'nutritionist', pet_nutritionist: 'pet_nutritionist',
    };
    const n = (v || '').toString().trim().toLowerCase().replace(/\s+/g, '_');
    const withSpace = (v || '').toString().trim().toLowerCase().replace(/\s+/g, ' ');
    return map[n] ?? map[withSpace] ?? n;
  };

  // Resolve category id (UUID from dropdown) to slug for specialization_master API
  const getCategorySlugForSpec = useCallback((catIdVal: string) => {
    if (!catIdVal) return '';
    const c = categories.find((cat: any) => String(cat?.id) === String(catIdVal) || String(cat?.category_id) === String(catIdVal));
    return (c?.category_id || c?.id || catIdVal) as string;
  }, [categories]);

  const loadSpecializationsForCatalog = useCallback((catId: string, rolesArr: string[]) => {
    const hasCat = !!catId;
    const hasRoles = rolesArr.length > 0;
    if (!showModal || (!hasCat && !hasRoles)) {
      setSpecializationsByCategory([]);
      return;
    }
    const canonRoles = rolesArr.map(toCanonicalRoleCode).filter(Boolean);
    const roleParam = canonRoles.length > 0 ? `roleIds=${encodeURIComponent(canonRoles.join(','))}` : '';
    const categorySlug = getCategorySlugForSpec(catId) || catId;
    const catParam = hasCat ? `categoryId=${encodeURIComponent(categorySlug)}` : '';
    const params = [catParam, roleParam].filter(Boolean).join('&');
    const url = `/admin/specializations?${params}`;
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
      console.log('[Catalog] Loading specializations', { catId, categorySlug, canonRoles, url });
    }
    setLoadingSpecializations(true);
    apiClient.get<any>(url)
      .then((data) => {
        const list = (data.specializations ?? data.data ?? []).map((s: any) => ({
          specializationId: s.specializationId ?? s.specialization_id,
          name: s.name ?? '',
          displayName: s.displayName ?? s.display_name ?? s.name ?? '',
        }));
        setSpecializationsByCategory(list);
        setFormData((prev) => {
          const validIds = new Set(list.map((s: { specializationId: string }) => s.specializationId));
          const kept = (prev.specialization_ids || []).filter((id: string) => validIds.has(id));
          return kept.length === (prev.specialization_ids?.length ?? 0) ? prev : { ...prev, specialization_ids: kept };
        });
      })
      .catch((err) => {
        if (typeof window !== 'undefined') console.warn('[Catalog] Specializations API failed', url, err);
        setSpecializationsByCategory([]);
      })
      .finally(() => setLoadingSpecializations(false));
  }, [showModal, getCategorySlugForSpec]);

  const applicableRolesKey = JSON.stringify(formData.applicable_roles ?? []);
  useEffect(() => {
    if (!showModal) return;
    loadSpecializationsForCatalog(formData.category_id || '', formData.applicable_roles ?? []);
  }, [showModal, formData.category_id, applicableRolesKey, loadSpecializationsForCatalog]);

  const handleReorder = async (serviceId: string, direction: 'up' | 'down') => {
    const currentIndex = services.findIndex(s => s.id === serviceId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= services.length) return;
    
    const service = services[currentIndex];
    const swapService = services[newIndex];
    
    try {
      await Promise.all([
        apiClient.put(`/admin/service-catalog/${service.id}`, { display_order: newIndex + 1 }),
        apiClient.put(`/admin/service-catalog/${swapService.id}`, { display_order: currentIndex + 1 }),
      ]);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to reorder services');
    }
  };

  // ============================================================================
  // FILTER LOGIC
  // ============================================================================

  const filteredServices = services.filter(service => {
    if (filterCategory && service.category_id !== filterCategory) return false;
    if (filterStatus && service.status !== filterStatus) return false;
    if (filterStyle && service.service_style !== filterStyle) return false;
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        service.service_name.toLowerCase().includes(search) ||
        service.display_name.toLowerCase().includes(search) ||
        service.description?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  // ============================================================================
  // RENDER
  // ============================================================================

  // Don't block rendering - show UI immediately with loading overlay
  // This ensures static export always has the full UI structure

  const SERVICE_STYLES = [
    { id: 'centre', label: 'Centre Visit', icon: 'Building' },
    { id: 'home', label: 'Home Service', icon: 'Home' },
    { id: 'tele', label: 'Tele-consultation', icon: 'Phone' },
    { id: 'ecommerce', label: 'E-commerce', icon: 'Shopping' },
    { id: 'all', label: 'All Styles', icon: 'All' },
  ];

  // ✅ FIX: Canonical roles (post-migration 250/521/522) - fetch active roles from API
  const CANONICAL_ROLES_FALLBACK = [
    'vet_solo', 'vet_clinic', 'groomer_solo', 'groomer_center', 'trainer_solo', 'trainer_center',
    'walker', 'sitter', 'boarding', 'cafe', 'pharmacy', 'ambulance', 'photographer', 'resort',
    'breeder', 'sunset', 'adoption_center', 'seller', 'relocation', 'diagnostics_center',
    'nutritionist', 'nutritionist_center', 'insurance', 'holiday', 'event_organizer',
  ];
  const [catalogRoles, setCatalogRoles] = useState<string[]>(CANONICAL_ROLES_FALLBACK);
  useEffect(() => {
    apiClient.get<any>('/admin/roles').then((r: any) => {
      const roles = r?.roles || r?.data || [];
      const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s || '');
      const names = Array.isArray(roles)
        ? roles
            .filter((x: any) => x.isActive !== false && x.is_active !== false)
            .map((x: any) => {
              const v = x.name || x.roleCode || (isUuid(x.roleId || x.id) ? null : (x.roleId || x.id));
              return v;
            })
            .filter(Boolean)
        : [];
      if (names.length > 0) setCatalogRoles(names);
    }).catch(() => {});
  }, []);
  const ROLES = catalogRoles;

  return (
    <AdminLayout>
      <div className="flex-1 flex flex-col min-h-screen bg-gray-50 relative">
        {/* Loading overlay - only show when actively loading */}
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center bg-white p-8 rounded-lg border border-gray-300 shadow-lg">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-900 font-medium">Loading service catalog...</p>
            </div>
          </div>
        )}
        
        {/* Header - Match wireframe: border-b, max-w-7xl mx-auto px-6 py-4 */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                {/* ✅ FIX: Match wireframe - text-2xl font-bold text-gray-900 */}
                <h1 className="text-2xl font-bold text-gray-900">Catalog & Services</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Effortlessly manage categories, products, services, pricing and inventory across the platform.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  placeholder="Search services, categories, subcategories..."
                  value={searchTerm}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm w-64"
                />
                <button
                  onClick={() => setActiveTab('servicecatalog')}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg font-medium hover:bg-gray-50 transition text-sm"
                >
                  Export
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition flex items-center gap-2"
                >
                  <span>+</span> Add Category
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition flex items-center gap-2"
                >
                  <span>+</span> Add Product
                </button>
              </div>
            </div>
          </div>
        </header>

      {/* Main Content - Match wireframe: max-w-7xl mx-auto p-6 or p-8 */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-white border border-red-300 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600" aria-label="Close">X</button>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-white border border-green-300 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600" aria-label="Close">X</button>
          </div>
        )}

        {/* Stats Cards - Matching Reference UI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-300 rounded-xl p-4 hover:shadow-md transition-shadow text-gray-900">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-blue-50 rounded-lg">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </div>
              {stats?.mainCategories?.change !== undefined && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <span>+{stats.mainCategories.change}</span>
                  <span>this month</span>
                </div>
              )}
            </div>
            <p className="text-gray-600 text-sm mb-1">Main Categories</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.mainCategories?.count || categories.length || 10}</p>
          </div>
          
          <div className="bg-white border border-gray-300 rounded-xl p-4 hover:shadow-md transition-shadow text-gray-900">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-green-50 rounded-lg">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              {stats?.activeProducts?.change !== undefined && (
                <div className="flex items-center gap-1 text-xs text-green-600">
                  <span>+{stats.activeProducts.change}</span>
                  <span>this week</span>
                </div>
              )}
            </div>
            <p className="text-gray-600 text-sm mb-1">Active Products</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.activeProducts?.count || services.filter(s => s.status === 'active').length || 32}</p>
          </div>
          
          <div className="bg-white border border-gray-300 rounded-xl p-4 hover:shadow-md transition-shadow text-gray-900">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-orange-50 rounded-lg">
                <svg className="w-5 h-5 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              {stats?.pendingReviews?.change !== undefined && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <span>-{stats.pendingReviews.change}</span>
                  <span>this month</span>
                </div>
              )}
            </div>
            <p className="text-gray-600 text-sm mb-1">Pending Reviews</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.pendingReviews?.count || 10}</p>
          </div>
          
          <div className="bg-white border border-gray-300 rounded-xl p-4 hover:shadow-md transition-shadow text-gray-900">
            <div className="flex items-start justify-between mb-2">
              <div className="p-2 bg-red-50 rounded-lg">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              {stats?.lowStockAlerts?.change !== undefined && (
                <div className="flex items-center gap-1 text-xs text-red-600">
                  <span>+{stats.lowStockAlerts.change}</span>
                  <span>this week</span>
                </div>
              )}
            </div>
            <p className="text-gray-600 text-sm mb-1">Low Stock Alerts</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.lowStockAlerts?.count || 23}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white border border-gray-300 rounded-2xl shadow-sm p-6 mb-6 text-gray-900">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex-1 min-w-[200px]">
              <input
                type="text"
                placeholder="Search services..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.display_name || cat.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
            <select
              value={filterStyle}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStyle(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Styles</option>
              {SERVICE_STYLES.map(style => (
                <option key={style.id} value={style.id}>{style.label}</option>
              ))}
            </select>
            <button
              onClick={loadData}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* ✅ FIX: Improved tabs with thicker border and better visual hierarchy */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm text-gray-900">
          <div className="border-b border-gray-200 px-4 flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-0 overflow-x-auto -mb-px">
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-3 text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap ${
                  activeTab === 'categories'
                    ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Categories
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-4 py-3 text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap ${
                  activeTab === 'roles'
                    ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Roles
              </button>
              <button
                onClick={() => setActiveTab('onboarding')}
                className={`px-4 py-3 text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap ${
                  activeTab === 'onboarding'
                    ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Onboarding
              </button>
              <button
                onClick={() => setActiveTab('servicecatalog')}
                className={`px-4 py-3 text-sm font-medium border-b-[3px] transition-colors whitespace-nowrap ${
                  activeTab === 'servicecatalog'
                    ? 'border-orange-500 text-orange-600 bg-orange-50/50'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Service Catalog
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'categories' && (
              <div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-4">Organize and manage service and product categories</p>
                  <div className="flex flex-wrap gap-4 items-center mb-4">
                    <select
                      value={filterStatus}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                      className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none text-sm"
                    >
                      <option value="">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <select
                      value={filterCategory}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterCategory(e.target.value)}
                      className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none text-sm"
                    >
                      <option value="">All Categories</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.display_name || cat.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      placeholder="Search..."
                      value={searchTerm}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                      className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                    />
                    <button 
                      onClick={async () => {
                        try {
                          const response = await apiClient.get<any>('/admin/catalog/export');
                          const data = response.categories || response.data || [];
                          const csvContent = [
                            ['ID', 'Name', 'Slug', 'Description', 'Parent ID', 'Is Active'],
                            ...data.map((cat: any) => [cat.id, cat.name, cat.slug, cat.description || '', cat.parent_id || '', cat.is_active])
                          ].map(row => row.join(',')).join('\n');
                          const blob = new Blob([csvContent], { type: 'text/csv' });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `categories_${new Date().toISOString().split('T')[0]}.csv`;
                          a.click();
                          setSuccess('Categories exported successfully!');
                        } catch (err: any) {
                          setError(err.message || 'Failed to export categories');
                        }
                      }}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                      Export
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await apiClient.post<any>('/admin/catalog/seed', { type: 'vet_only' });
                          setSuccess('Vet services seeded successfully! Refresh to see changes.');
                        } catch (err: any) {
                          setError(err.message || 'Failed to seed vet data');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                      Seed Vet Only
                    </button>
                    <button 
                      onClick={async () => {
                        try {
                          setLoading(true);
                          await apiClient.post<any>('/admin/catalog/seed', { type: 'all' });
                          setSuccess('All services seeded successfully! Refresh to see changes.');
                        } catch (err: any) {
                          setError(err.message || 'Failed to seed all data');
                        } finally {
                          setLoading(false);
                        }
                      }}
                      className="px-4 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition text-sm"
                    >
                      Seed All
                    </button>
                  </div>
                </div>
                <CategoriesTab />
              </div>
            )}
            
            {activeTab === 'roles' && (
              <div className="p-6">
                <VendorRolesTab />
              </div>
            )}
            
            {activeTab === 'onboarding' && (
              <div className="p-6">
                <OnboardingDesigner />
              </div>
            )}
            
            {activeTab === 'servicecatalog' && (
              <div className="p-6 bg-white">
                <ServiceCatalogTab />
              </div>
            )}
            
            {false && activeTab === 'servicecatalog' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">Search services, categories, subcategories...</p>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition">
                      Expand All
                    </button>
                    <button className="px-3 py-1 text-sm bg-white border border-gray-300 text-gray-900 rounded-lg hover:bg-gray-50 transition">
                      Collapse All
                    </button>
                  </div>
                </div>
                <HierarchicalServiceList
                  searchQuery={searchTerm}
                  filterCategory={filterCategory}
                  filterStatus={filterStatus}
                  onEdit={(service) => {
                    const serviceData: Partial<ServiceCatalogItem> = {
                      id: service.id,
                      service_id: service.service_id,
                      service_name: service.service_name,
                      display_name: service.display_name,
                      description: service.description,
                      category_id: service.category_id,
                      category_name: service.category_name,
                      sub_category_id: service.sub_category_id,
                      sub_category_name: service.sub_category_name,
                      applicable_roles: service.applicable_roles,
                      service_style: (service.service_style === 'at_center' ? 'centre' : service.service_style === 'at_home' ? 'home' : service.service_style) as any,
                      base_price: service.base_price,
                      duration_minutes: service.duration_minutes,
                      status: (service.status === 'archived' ? 'inactive' : service.status) as 'active' | 'inactive' | 'draft',
                      publish_status: service.publish_status === 'archived' ? 'archived' : (service.publish_status || 'published') as 'published' | 'unpublished' | 'archived',
                      display_order: service.display_order,
                      metadata: service.metadata,
                    };
                    setEditingService(serviceData as ServiceCatalogItem);
                    setFormData(serviceData);
                    setShowModal(true);
                  }}
                  onDelete={(service) => {
                    handleDelete(service as any);
                  }}
                  onAddService={(categoryId, subcategoryId) => {
                    setFormData({
                      ...formData,
                      category_id: categoryId,
                      sub_category_id: subcategoryId,
                    });
                    setEditingService(null);
                    setShowModal(true);
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Floating Action Button */}
        <button
          onClick={handleCreate}
          className="fixed bottom-8 right-8 w-14 h-14 bg-orange-500 hover:bg-orange-600 rounded-full flex items-center justify-center shadow-lg z-50 transition"
        >
          <span className="text-white text-2xl font-bold">+</span>
        </button>
        </div>
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-gray-300 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto text-gray-900">
            <div className="p-6 border-b border-gray-300 sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingService ? 'Edit Service' : 'Create Service'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-xl font-bold" aria-label="Close">X</button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Name (ID)</label>
                  <input
                    type="text"
                    value={formData.service_name || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., full_grooming"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={formData.display_name || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., Full Grooming Package"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category_id || ''}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                      const newCategoryId = e.target.value;
                      setFormData(prev => ({ ...prev, category_id: newCategoryId }));
                      loadSpecializationsForCatalog(newCategoryId, formData.applicable_roles ?? []);
                    }}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.display_name || cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Style</label>
                  <select
                    value={formData.service_style || 'centre'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, service_style: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                  >
                    {SERVICE_STYLES.map(style => (
                      <option key={style.id} value={style.id}>{style.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (INR)</label>
                  <input
                    type="number"
                    value={formData.base_price || 0}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, base_price: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={formData.duration_minutes || 30}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  />
                </div>
              </div>

              {/* Applicable Roles — select first so specializations below filter dynamically */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Applicable Roles <span className="text-red-500">*</span></label>
                <p className="text-xs text-gray-500 mb-2">Select roles that can use this service. Specializations below are filtered by these roles (from Catalog &gt; Categories).</p>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        const roles = formData.applicable_roles || [];
                        const canon = toCanonicalRoleCode(role);
                        const newRoles = roles.includes(canon)
                          ? roles.filter(r => toCanonicalRoleCode(r) !== canon)
                          : [...roles.filter(r => toCanonicalRoleCode(r) !== canon), canon];
                        setFormData(prev => ({ ...prev, applicable_roles: newRoles }));
                        loadSpecializationsForCatalog(formData.category_id || '', newRoles);
                      }}
                      className={`px-3 py-1 rounded-lg text-sm transition ${
                        (formData.applicable_roles || []).map(toCanonicalRoleCode).includes(toCanonicalRoleCode(role))
                          ? 'bg-orange-500 text-white'
                          : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      {role.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Specializations (optional) — from Catalog > Categories, filtered by selected applicable roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Specializations (optional)</label>
                <p className="text-xs text-gray-500 mb-2">Link this service to category specializations (Catalog &gt; Categories), filtered by selected applicable roles.</p>
                {!formData.category_id ? (
                  <p className="text-sm text-gray-400">Select a category first to load specializations.</p>
                ) : loadingSpecializations ? (
                  <p className="text-sm text-gray-500">Loading…</p>
                ) : specializationsByCategory.length === 0 ? (
                  <p className="text-sm text-gray-500">No specializations for this category and selected roles.</p>
                ) : (
                  <>
                    {(formData.applicable_roles?.length ?? 0) === 0 && (
                      <p className="text-xs text-amber-600 mb-2">Showing all specializations for this category. Select applicable roles above to filter.</p>
                    )}
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                      {specializationsByCategory.map((spec) => {
                        const selected = (formData.specialization_ids || []).includes(spec.specializationId);
                        return (
                          <button
                            key={spec.specializationId}
                            type="button"
                            onClick={() => {
                              const current = formData.specialization_ids || [];
                              setFormData(prev => ({
                                ...prev,
                                specialization_ids: selected
                                  ? current.filter((id) => id !== spec.specializationId)
                                  : [...current, spec.specializationId],
                              }));
                            }}
                            className={`px-3 py-1 rounded-lg text-sm transition ${
                              selected
                                ? 'bg-purple-500 text-white'
                                : 'bg-white border border-gray-300 text-gray-900 hover:bg-gray-50'
                            }`}
                          >
                            {spec.displayName || spec.name}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Publish Status</label>
                  <select
                    value={formData.publish_status || 'published'}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, publish_status: e.target.value as any }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                  >
                    <option value="published">Published</option>
                    <option value="unpublished">Unpublished</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-300 bg-white flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-white border border-gray-300 text-gray-900 rounded-lg font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingService ? 'Update Service' : 'Create Service'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

