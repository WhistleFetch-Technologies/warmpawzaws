'use client';

import { useState, useEffect, useMemo } from 'react';
import { Search, Plus, Edit, Trash2, Eye, Users, Package, Tag, Layout, IndianRupee, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from './StatusBadge';
import { CatalogActiveSwitch } from './CatalogActiveSwitch';
import { AddServiceModal } from './AddServiceModal';
import { EnhancedModal } from '../shared/EnhancedModal';
import { EnhancedButton } from '../shared/EnhancedButton';

function serviceCatalogListCategoryLabel(s: {
  category_name?: string | null;
  category_id?: string | null;
}): string {
  const id = String(s.category_id ?? '').trim();
  const name = String(s.category_name ?? '').trim();
  if (name && !(name.toLowerCase() === 'general' && id && id.toLowerCase() !== 'general')) {
    return name;
  }
  if (id) {
    const known: Record<string, string> = {
      veterinary: 'Veterinary Services',
      diagnostic: 'Diagnostics & Lab',
      diagnostics: 'Diagnostics & Lab',
      grooming: 'Grooming & Hygiene',
    };
    const mapped = known[id.toLowerCase()];
    if (mapped) return mapped;
    return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return '';
}

interface Service {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'pending' | 'draft';
  price: number;
  description?: string;
  createdAt: string;
  categoryId?: string;
  subCategoryId?: string;
  serviceType?: string;
  duration?: number;
  applicableRoles?: string[];
  specializationIds?: string[];
  metadata?: Record<string, unknown>;
  isPackage?: boolean;
}

export type FilterMissing = 'none' | 'roles' | 'specialization' | 'style' | 'price' | 'duration';
export type FilterType = 'all' | 'package' | 'service';
export type FilterStatus = 'all' | 'active' | 'inactive' | 'draft';

export function ServiceCatalogTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterMissing, setFilterMissing] = useState<FilterMissing>('none');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [viewingService, setViewingService] = useState<Service | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      // Admin endpoint returns all services (active + inactive) unless status filter is passed
      const data = await apiClient.get<any>('/admin/service-catalog?groupBy=none');
      
      console.log('🔍 [ServiceCatalogTab] API Response:', {
        success: data?.success,
        hasServices: !!data?.services,
        hasData: !!data?.data,
        servicesLength: Array.isArray(data?.services) ? data.services.length : 0,
        dataLength: Array.isArray(data?.data) ? data.data.length : 0,
        grouped: data?.grouped,
      });
      
      // Handle response format: { success: true, services: [...] }
      let servicesArray: any[] = [];
      
      if (data.services && Array.isArray(data.services)) {
        // Check if services are grouped (from groupBy parameter)
        if (data.grouped && data.services.length > 0 && data.services[0].services) {
          // Flatten grouped services
          servicesArray = data.services.flatMap((group: any) => 
            (group.services || []).map((s: any) => s)
          );
          console.log('🔍 [ServiceCatalogTab] Flattened grouped services:', servicesArray.length);
        } else {
          // Direct array of services
          servicesArray = data.services;
          console.log('🔍 [ServiceCatalogTab] Using services array directly:', servicesArray.length);
        }
      } else if (data.data && Array.isArray(data.data)) {
        servicesArray = data.data;
        console.log('🔍 [ServiceCatalogTab] Using data array:', servicesArray.length);
      } else if (Array.isArray(data)) {
        servicesArray = data;
        console.log('🔍 [ServiceCatalogTab] Response is array:', servicesArray.length);
      } else {
        console.warn('🔍 [ServiceCatalogTab] No services found in response:', data);
      }
      
      const mappedServices: Service[] = servicesArray.map((s: any) => ({
        id: s.id || s.service_id,
        name: s.service_name || s.display_name || s.name,
        category: serviceCatalogListCategoryLabel(s),
        status: (['active', 'inactive', 'draft', 'pending'].includes(s.status)
          ? s.status
          : s.status === 'archived' ? 'inactive' : 'inactive') as 'active' | 'inactive' | 'pending' | 'draft',
        price: s.base_price ?? s.price ?? 0,
        description: s.description,
        createdAt: s.created_at || s.createdAt || new Date().toISOString(),
        categoryId: s.category_id,
        subCategoryId: s.sub_category_id,
        serviceType: s.service_style || s.serviceType,
        duration: s.duration_minutes ?? s.duration,
        applicableRoles: s.applicable_roles || [],
        specializationIds: s.specialization_ids || s.specializationIds || [],
        metadata: s.metadata || {},
        isPackage: !!(s.metadata?.isPackage ?? s.isPackage),
      }));
      
      console.log('🔍 [ServiceCatalogTab] Mapped services:', mappedServices.length);
      setServices(mappedServices);
    } catch (error) {
      console.error('❌ [ServiceCatalogTab] Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  // Analytics (click-to-list counts)
  const analytics = useMemo(() => {
    const activeRolesSet = new Set<string>();
    let packageCount = 0;
    let serviceCount = 0;
    let missingRoles = 0;
    let missingSpecialization = 0;
    let missingStyle = 0;
    let missingPrice = 0;
    let missingDuration = 0;
    for (const s of services) {
      (s.applicableRoles || []).forEach((r: string) => activeRolesSet.add(r));
      if (s.isPackage) packageCount++; else serviceCount++;
      if (!(s.applicableRoles?.length)) missingRoles++;
      if (!(s.specializationIds?.length)) missingSpecialization++;
      if (!s.serviceType || String(s.serviceType).trim() === '') missingStyle++;
      if (s.price == null || Number(s.price) <= 0) missingPrice++;
      if (s.duration == null || Number(s.duration) <= 0) missingDuration++;
    }
    return {
      activeRolesCount: activeRolesSet.size,
      packageCount,
      serviceCount,
      missingRoles,
      missingSpecialization,
      missingStyle,
      missingPrice,
      missingDuration,
    };
  }, [services]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const search = searchQuery.toLowerCase().trim();
      if (search && !service.name.toLowerCase().includes(search) && !service.category.toLowerCase().includes(search) && !(service.description || '').toLowerCase().includes(search)) return false;
      if (filterType === 'package' && !service.isPackage) return false;
      if (filterType === 'service' && service.isPackage) return false;
      if (filterStatus !== 'all' && service.status !== filterStatus) return false;
      if (filterMissing !== 'none') {
        if (filterMissing === 'roles' && (service.applicableRoles?.length ?? 0) > 0) return false;
        if (filterMissing === 'specialization' && (service.specializationIds?.length ?? 0) > 0) return false;
        if (filterMissing === 'style' && service.serviceType && String(service.serviceType).trim()) return false;
        if (filterMissing === 'price' && service.price != null && Number(service.price) > 0) return false;
        if (filterMissing === 'duration' && service.duration != null && Number(service.duration) > 0) return false;
      }
      return true;
    });
  }, [services, searchQuery, filterType, filterStatus, filterMissing]);

  const handleAddService = () => {
    setEditingService(null);
    setAddModalOpen(true);
  };

  const handleEditService = (service: Service) => {
    setEditingService(service);
    setAddModalOpen(true);
  };

  const handleViewService = (service: Service) => {
    setViewingService(service);
    setViewModalOpen(true);
  };

  const handleToggleStatus = async (service: Service, enable: boolean) => {
    if (togglingId) return;

    setTogglingId(service.id);
    const nextStatus = enable ? 'active' : 'inactive';
    setServices(prev => prev.map(s => (s.id === service.id ? { ...s, status: nextStatus } : s)));
    if (!enable && filterStatus === 'active') setFilterStatus('all');
    try {
      await apiClient.put(`/admin/service-catalog/${service.id}`, enable
        ? { status: 'active', publish_status: 'published' }
        : { status: 'inactive', publish_status: 'unpublished' });
      toast.success(
        enable
          ? `"${service.name}" is now visible to customers`
          : `"${service.name}" is hidden from customers (still visible here in admin)`
      );
    } catch (error: any) {
      console.error('Error toggling service status:', error);
      setServices(prev => prev.map(s => (s.id === service.id ? service : s)));
      toast.error(error.message || `Failed to ${enable ? 'enable' : 'disable'} service`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDeleteService = async (service: Service) => {
    if (!confirm(`Are you sure you want to delete "${service.name}"?`)) {
      return;
    }

    try {
      await apiClient.delete(`/admin/service-catalog/${service.id}`);
      alert('Service deleted successfully!');
      loadServices();
    } catch (error: any) {
      console.error('Error deleting service:', error);
      alert(error.message || 'Failed to delete service');
    }
  };

  const handleModalSuccess = () => {
    loadServices();
  };

  if (loading) {
    return <div className="p-0 text-center text-gray-500">Loading services...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6 bg-white pb-4 border-b border-gray-300">
        <h2 className="text-2xl font-bold text-gray-900">Service Catalog</h2>
        <Button 
          onClick={handleAddService}
          className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white border-0"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Service
        </Button>
      </div>
      
      {/* Analytics widgets (click to filter list) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
        <button
          type="button"
          onClick={() => { setFilterMissing('none'); setFilterType('all'); }}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
            filterMissing === 'none' && filterType === 'all'
              ? 'border-orange-500 bg-orange-50 text-orange-800'
              : 'border-gray-200 bg-white hover:border-gray-300 text-gray-700'
          }`}
        >
          <span className="text-lg font-bold text-gray-900">{services.length}</span>
          <span className="text-xs text-gray-600">Total</span>
        </button>
        <button
          type="button"
          onClick={() => { setFilterType('all'); setFilterMissing('none'); setSearchQuery(''); }}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
            filterType === 'all' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          title="Click to see services with roles"
        >
          <Users className="w-4 h-4 text-blue-600 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-gray-900">{analytics.activeRolesCount}</span>
            <span className="block text-xs text-gray-500">Active roles</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => { setFilterType('package'); setFilterMissing('none'); }}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
            filterType === 'package' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <Package className="w-4 h-4 text-purple-600 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-gray-900">{analytics.packageCount}</span>
            <span className="block text-xs text-gray-500">Packages</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => { setFilterType('service'); setFilterMissing('none'); }}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
            filterType === 'service' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <Tag className="w-4 h-4 text-green-600 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-gray-900">{analytics.serviceCount}</span>
            <span className="block text-xs text-gray-500">Services</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilterMissing(analytics.missingRoles ? 'roles' : filterMissing)}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
            filterMissing === 'roles' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          title="Missing applicable roles"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-gray-900">{analytics.missingRoles}</span>
            <span className="block text-xs text-gray-500">Missing roles</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilterMissing(analytics.missingSpecialization ? 'specialization' : filterMissing)}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
            filterMissing === 'specialization' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          title="Missing specializations"
        >
          <Tag className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-gray-900">{analytics.missingSpecialization}</span>
            <span className="block text-xs text-gray-500">Missing spec</span>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setFilterMissing(analytics.missingStyle ? 'style' : filterMissing)}
          className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
            filterMissing === 'style' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
          title="Missing service style"
        >
          <Layout className="w-4 h-4 text-amber-600 shrink-0" />
          <div>
            <span className="text-sm font-semibold text-gray-900">{analytics.missingStyle}</span>
            <span className="block text-xs text-gray-500">Missing style</span>
          </div>
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => setFilterMissing(analytics.missingPrice ? 'price' : filterMissing)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${
            filterMissing === 'price' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <IndianRupee className="w-4 h-4 text-amber-600" />
          <span>Missing price: {analytics.missingPrice}</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterMissing(analytics.missingDuration ? 'duration' : filterMissing)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm ${
            filterMissing === 'duration' ? 'border-amber-500 bg-amber-50' : 'border-gray-200 bg-white hover:border-gray-300'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-600" />
          <span>Missing duration: {analytics.missingDuration}</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value as FilterStatus)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
        >
          <option value="all">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
        </select>
        <select
          value={filterType}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterType(e.target.value as FilterType)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
        >
          <option value="all">All types</option>
          <option value="package">Package only</option>
          <option value="service">Service only</option>
        </select>
        <select
          value={filterMissing}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFilterMissing(e.target.value as FilterMissing)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
        >
          <option value="none">No missing filter</option>
          <option value="roles">Missing roles</option>
          <option value="specialization">Missing specialization</option>
          <option value="style">Missing style</option>
          <option value="price">Missing price</option>
          <option value="duration">Missing duration</option>
        </select>
        {(filterType !== 'all' || filterStatus !== 'all' || filterMissing !== 'none') && (
          <button
            type="button"
            onClick={() => { setFilterType('all'); setFilterStatus('all'); setFilterMissing('none'); }}
            className="px-3 py-2 text-sm text-orange-600 hover:text-orange-700 font-medium"
          >
            Clear filters
          </button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Showing <strong>{filteredServices.length}</strong> of {services.length} services
        {(filterType !== 'all' || filterStatus !== 'all' || filterMissing !== 'none') && ' (filtered)'}.
        {' '}Turning off the switch hides a service from customers only — it always stays in this admin list.
      </p>

      {filteredServices.length === 0 ? (
        <div className="p-8 text-center bg-white border border-gray-300 rounded-lg">
          <p className="text-gray-600 mb-2">No services found</p>
          <p className="text-sm text-gray-500">
            {loading ? 'Loading services...' : 'Services will appear here once they are created. Check if seeding completed successfully.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 bg-white">
          {filteredServices.map((service) => (
            <div 
              key={service.id} 
              className={`bg-white border rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:border-[#FF8C42]/30 ${
                service.status === 'active' ? 'border-gray-200' : 'border-gray-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <h4 className="text-lg font-semibold text-gray-900">{service.name}</h4>
                    <StatusBadge status={service.status} />
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full border bg-purple-50 text-purple-700 border-purple-200">
                      {service.isPackage ? 'Package' : 'Service'}
                    </span>
                    {service.category ? (
                      <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                        {service.category}
                      </span>
                    ) : null}
                  </div>
                  
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{service.description}</p>
                  )}
                  
                  <div className="flex items-center gap-6 text-sm flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Price:</span>
                      <span className={`font-bold text-base ${(service.price == null || Number(service.price) <= 0) ? 'text-amber-600' : 'text-[#FF8C42]'}`}>
                        {(service.price != null && Number(service.price) > 0) ? `₹${Number(service.price).toFixed(2)}` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <span>Duration:</span>
                      <span className={`font-medium ${(service.duration == null || Number(service.duration) <= 0) ? 'text-amber-600' : 'text-gray-900'}`}>
                        {(service.duration != null && Number(service.duration) > 0) ? `${service.duration} min` : '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <span>Created:</span>
                      <span className="font-medium">{service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 ml-6 shrink-0">
                  <CatalogActiveSwitch
                    active={service.status === 'active'}
                    loading={togglingId === service.id}
                    onToggle={(enable) => handleToggleStatus(service, enable)}
                  />
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[#FF8C42] hover:text-[#FF8C42] transition-colors"
                    onClick={() => handleViewService(service)}
                  >
                    <Eye className="w-4 h-4 mr-1.5" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-gray-300 text-gray-700 hover:bg-gray-50 hover:border-[#FF8C42] hover:text-[#FF8C42] transition-colors"
                    onClick={() => handleEditService(service)}
                  >
                    <Edit className="w-4 h-4 mr-1.5" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                    onClick={() => handleDeleteService(service)}
                  >
                    <Trash2 className="w-4 h-4 mr-1.5" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Service Modal */}
      <AddServiceModal
        isOpen={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setEditingService(null);
        }}
        onSuccess={handleModalSuccess}
        categoryId={editingService?.categoryId}
        subCategoryId={editingService?.subCategoryId}
        service={editingService}
      />

      {/* View Service Modal */}
      {viewModalOpen && viewingService && (
        <EnhancedModal
          isOpen={viewModalOpen}
          onClose={() => {
            setViewModalOpen(false);
            setViewingService(null);
          }}
          title="Service Details"
          subtitle="View complete service information"
          icon={<Eye className="w-5 h-5 text-white" />}
          maxWidth="lg"
          footer={
            <div className="flex items-center justify-end gap-3">
              <EnhancedButton
                variant="outline"
                onClick={() => {
                  setViewModalOpen(false);
                  setViewingService(null);
                }}
              >
                Close
              </EnhancedButton>
              <EnhancedButton
                variant="primary"
                onClick={() => {
                  setViewModalOpen(false);
                  handleEditService(viewingService);
                }}
                icon={Edit}
                iconPosition="left"
              >
                Edit Service
              </EnhancedButton>
            </div>
          }
        >

          <div className="space-y-5">
            <div className="bg-gradient-to-r from-gray-50 to-white p-4 rounded-lg border border-gray-200">
              <h4 className="text-lg font-bold text-gray-900 mb-1">{viewingService.name}</h4>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <StatusBadge status={viewingService.status} />
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${viewingService.isPackage ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                  {viewingService.isPackage ? 'Package' : 'Service'}
                </span>
                {viewingService.category ? (
                  <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                    {viewingService.category}
                  </span>
                ) : null}
              </div>
            </div>

            {viewingService.description && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <p className="text-gray-600 bg-gray-50 p-3 rounded-lg">{viewingService.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Price</label>
                <p className={`text-xl font-bold ${(viewingService.price != null && Number(viewingService.price) > 0) ? 'text-[#FF8C42]' : 'text-amber-600'}`}>
                  {(viewingService.price != null && Number(viewingService.price) > 0) ? `₹${Number(viewingService.price).toFixed(2)}` : '— Not set'}
                </p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Duration</label>
                <p className={`text-lg font-semibold ${(viewingService.duration != null && Number(viewingService.duration) > 0) ? 'text-gray-900' : 'text-amber-600'}`}>
                  {(viewingService.duration != null && Number(viewingService.duration) > 0) ? `${viewingService.duration} minutes` : '— Not set'}
                </p>
              </div>
            </div>

            {viewingService.serviceType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
                <span className="inline-block px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium">
                  {viewingService.serviceType}
                </span>
              </div>
            )}

            {viewingService.applicableRoles && viewingService.applicableRoles.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Applicable Roles</label>
                <div className="flex flex-wrap gap-2">
                  {viewingService.applicableRoles.map((role, idx) => (
                    <span key={idx} className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-sm font-medium border border-orange-200">
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Created Date</label>
              <p className="text-sm text-gray-600">
                {viewingService.createdAt ? new Date(viewingService.createdAt).toLocaleString() : 'N/A'}
              </p>
            </div>
          </div>
        </EnhancedModal>
      )}
    </div>
  );
}

