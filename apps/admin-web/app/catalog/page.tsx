'use client';

import React, { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api-client';
import { AdminLayout } from '@/components/AdminLayout';

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
  service_style: 'centre' | 'home' | 'tele' | 'ecommerce' | 'all';
  base_price: number;
  duration_minutes: number;
  status: 'active' | 'inactive' | 'draft';
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
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
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
      
      const [servicesRes, categoriesRes] = await Promise.all([
        apiClient.get<any>('/admin/service-catalog'),
        apiClient.get<any>('/service-catalog/categories'),
      ]);
      
      setServices(servicesRes.services || servicesRes || []);
      setCategories(categoriesRes.categories || categoriesRes || []);
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading service catalog...</p>
        </div>
      </div>
    );
  }

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
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Service Catalog</h1>
            <p className="text-gray-500">Manage platform services offered by vendors</p>
          </div>
          <button
            onClick={handleCreate}
            className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition flex items-center gap-2"
          >
            <span>+</span> Add Service
          </button>
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

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="text-3xl mb-2">📚</div>
            <p className="text-3xl font-bold text-gray-900">{services.length}</p>
            <p className="text-sm text-gray-500">Total Services</p>
          </div>
          <div className="bg-green-50 rounded-2xl p-6">
            <div className="text-3xl mb-2">✅</div>
            <p className="text-3xl font-bold text-green-600">{services.filter(s => s.status === 'active').length}</p>
            <p className="text-sm text-green-600">Active</p>
          </div>
          <div className="bg-yellow-50 rounded-2xl p-6">
            <div className="text-3xl mb-2">📝</div>
            <p className="text-3xl font-bold text-yellow-600">{services.filter(s => s.status === 'draft').length}</p>
            <p className="text-sm text-yellow-600">Drafts</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-6">
            <div className="text-3xl mb-2">🚫</div>
            <p className="text-3xl font-bold text-gray-600">{services.filter(s => s.status === 'inactive').length}</p>
            <p className="text-sm text-gray-600">Inactive</p>
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
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.display_name || cat.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
            <select
              value={filterStyle}
              onChange={(e) => setFilterStyle(e.target.value)}
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

        {/* Services Table */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Style</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredServices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-4xl mb-2">📭</div>
                    <p>No services found</p>
                  </td>
                </tr>
              ) : (
                filteredServices.map((service, index) => (
                  <tr key={service.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => handleReorder(service.id, 'up')}
                          disabled={index === 0}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▲
                        </button>
                        <span className="text-sm text-gray-500 text-center">{service.display_order || index + 1}</span>
                        <button
                          onClick={() => handleReorder(service.id, 'down')}
                          disabled={index === filteredServices.length - 1}
                          className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
                        >
                          ▼
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{service.display_name}</p>
                        <p className="text-sm text-gray-500">{service.service_name}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{service.category_name}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                        {SERVICE_STYLES.find(s => s.id === service.service_style)?.icon} {service.service_style}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium">₹{service.base_price}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{service.duration_minutes} min</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleToggleStatus(service)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          service.status === 'active' ? 'bg-green-100 text-green-700' :
                          service.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {service.status}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(service)}
                          className="text-orange-500 hover:text-orange-600 text-sm font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(service)}
                          className="text-red-500 hover:text-red-600 text-sm font-medium"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
                    onChange={(e) => setFormData(prev => ({ ...prev, service_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., full_grooming"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={formData.display_name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                    placeholder="e.g., Full Grooming Package"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category_id || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, service_style: e.target.value as any }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, base_price: Number(e.target.value) }))}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Duration (minutes)</label>
                  <input
                    type="number"
                    value={formData.duration_minutes || 30}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration_minutes: Number(e.target.value) }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
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
                    onChange={(e) => setFormData(prev => ({ ...prev, publish_status: e.target.value as any }))}
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

