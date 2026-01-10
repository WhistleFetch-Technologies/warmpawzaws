'use client';
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { HierarchicalServiceList } from '@/components/admin/catalog/HierarchicalServiceList';
import { CategoriesTab } from '@/components/admin/catalog/CategoriesTab';
import { ProductServicesTab } from '@/components/admin/catalog/ProductServicesTab';
import { PricingInventoryTab } from '@/components/admin/catalog/PricingInventoryTab';
import { BulkOperationsTab } from '@/components/admin/catalog/BulkOperationsTab';
import { ServiceCatalogTab } from '@/components/admin/catalog/ServiceCatalogTab';

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
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ServiceCatalogPage() {
  const [activeTab, setActiveTab] = useState<'categories' | 'products' | 'pricing' | 'bulk' | 'roles' | 'onboarding' | 'servicecatalog'>('categories');
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
      
      // Handle grouped services response
      if (servicesRes.grouped && Array.isArray(servicesRes.services)) {
        // Flatten grouped structure for compatibility
        const allServices: ServiceCatalogItem[] = [];
        servicesRes.services.forEach((cat: any) => {
          if (cat.subcategories && Array.isArray(cat.subcategories)) {
            cat.subcategories.forEach((subcat: any) => {
              if (subcat.services && Array.isArray(subcat.services)) {
                allServices.push(...subcat.services);
              }
            });
          }
          if (cat.services && Array.isArray(cat.services)) {
            allServices.push(...cat.services);
          }
        });
        setServices(allServices);
      } else {
        setServices(servicesRes.services || servicesRes || []);
      }
      
      setCategories(categoriesRes.categories || categoriesRes || []);
      
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
    setFormData({
      service_name: service.service_name,
      display_name: service.display_name,
      description: service.description,
      category_id: service.category_id,
      applicable_roles: service.applicable_roles,
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
        await apiClient.post('/admin/service-catalog', formData);
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
    { id: 'centre', label: 'Centre Visit', icon: '🏢' },
    { id: 'home', label: 'Home Service', icon: '🏠' },
    { id: 'tele', label: 'Tele-consultation', icon: '📱' },
    { id: 'ecommerce', label: 'E-commerce', icon: '🛒' },
    { id: 'all', label: 'All Styles', icon: '✨' },
  ];

  const ROLES = [
    'veterinarian', 'vet_clinic', 'pet_groomer', 'pet_trainer', 'pet_walker',
    'pet_sitter', 'pet_boarder', 'pet_cafe', 'pharmacy', 'ambulance',
    'diagnostics_center', 'pet_photographer', 'pet_transport',
  ];

  return (
    <AdminLayout>
      <div className="min-h-screen bg-slate-50 relative">
        {/* Loading overlay - only show when actively loading */}
        {loading && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading service catalog...</p>
            </div>
          </div>
        )}
        
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">Catalog & Services</h1>
                <span className="text-sm text-gray-500">/Catalog Management</span>
              </div>
              <p className="text-sm text-gray-500">
                Effortlessly manage categories, products, services, pricing and inventory across the platform.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search services, categories, subcategories..."
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none text-sm w-64"
              />
              <button
                onClick={() => setActiveTab('servicecatalog')}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition text-sm"
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
        </header>

      <main className="p-8">
        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}

        {/* Stats Cards - Matching Reference UI */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
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
          
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
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
          
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
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
          
          <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
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
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
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
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition"
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200 px-6 py-2 flex items-center justify-between flex-wrap gap-4">
            <div className="flex gap-0 overflow-x-auto">
              <button
                onClick={() => setActiveTab('categories')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'categories'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Categories
              </button>
              <button
                onClick={() => setActiveTab('products')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'products'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Product & Services
              </button>
              <button
                onClick={() => setActiveTab('pricing')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'pricing'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Pricing & Inventory
              </button>
              <button
                onClick={() => setActiveTab('bulk')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'bulk'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Bulk Operations
              </button>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'roles'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Roles
              </button>
              <button
                onClick={() => setActiveTab('onboarding')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'onboarding'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Onboarding
              </button>
              <button
                onClick={() => setActiveTab('servicecatalog')}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === 'servicecatalog'
                    ? 'border-orange-500 text-orange-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
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
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                      Export
                    </button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                      Seed Vet Only
                    </button>
                    <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm">
                      Seed All
                    </button>
                  </div>
                </div>
                <CategoriesTab />
              </div>
            )}
            
            {activeTab === 'products' && <ProductServicesTab />}
            {activeTab === 'pricing' && <PricingInventoryTab />}
            {activeTab === 'bulk' && <BulkOperationsTab />}
            
            {activeTab === 'roles' && (
              <div className="text-center py-12 text-gray-500">
                <p>Roles management coming soon...</p>
              </div>
            )}
            
            {activeTab === 'onboarding' && (
              <div className="text-center py-12 text-gray-500">
                <p>Onboarding management coming soon...</p>
              </div>
            )}
            
            {activeTab === 'servicecatalog' && (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">Search services, categories, subcategories...</p>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
                      Expand All
                    </button>
                    <button className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition">
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
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingService ? 'Edit Service' : 'Create Service'}
                </h3>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
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
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
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
                      <option key={style.id} value={style.id}>{style.icon} {style.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Base Price (₹)</label>
                  <input
                    type="number"
                    value={formData.base_price || 0}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, base_price: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
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

              {/* Applicable Roles */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Applicable Roles</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                  {ROLES.map(role => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => {
                        const roles = formData.applicable_roles || [];
                        setFormData(prev => ({
                          ...prev,
                          applicable_roles: roles.includes(role)
                            ? roles.filter(r => r !== role)
                            : [...roles, role]
                        }));
                      }}
                      className={`px-3 py-1 rounded-lg text-sm transition ${
                        (formData.applicable_roles || []).includes(role)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {role.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
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
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
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

