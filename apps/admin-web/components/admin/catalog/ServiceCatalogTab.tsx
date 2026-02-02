'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, X } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from './StatusBadge';
import { AddServiceModal } from './AddServiceModal';
import { EnhancedModal } from '../shared/EnhancedModal';
import { EnhancedButton } from '../shared/EnhancedButton';

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
}

export function ServiceCatalogTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [viewingService, setViewingService] = useState<Service | null>(null);

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      
      // Use admin service catalog endpoint directly - it returns all services
      const data = await apiClient.get<any>('/admin/service-catalog');
      
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
        category: s.category_name || s.category_id || 'General',
        status: (s.status === 'active' ? 'active' : s.publish_status === 'published' ? 'active' : 'inactive') as 'active' | 'inactive' | 'pending' | 'draft',
        price: s.base_price || s.price || 0,
        description: s.description,
        createdAt: s.created_at || s.createdAt || new Date().toISOString(),
        categoryId: s.category_id,
        subCategoryId: s.sub_category_id,
        serviceType: s.service_style || s.serviceType,
        duration: s.duration_minutes || s.duration,
        applicableRoles: s.applicable_roles || [],
        specializationIds: s.specialization_ids || s.specializationIds || [],
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

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
      
      <div className="flex items-center justify-between mb-4 bg-white">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
          />
        </div>
      </div>

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
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-lg transition-all duration-200 hover:border-[#FF8C42]/30"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h4 className="text-lg font-semibold text-gray-900">{service.name}</h4>
                    <StatusBadge status={service.status} />
                    <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                      {service.category}
                    </span>
                  </div>
                  
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{service.description}</p>
                  )}
                  
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-500">Price:</span>
                      <span className="font-bold text-[#FF8C42] text-base">₹{service.price}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-500">
                      <span>Created:</span>
                      <span className="font-medium">{service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-6">
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
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={viewingService.status} />
                <span className="px-3 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded-full">
                  {viewingService.category}
                </span>
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
                <p className="text-xl font-bold text-[#FF8C42]">₹{viewingService.price}</p>
              </div>
              {viewingService.duration && (
                <div className="bg-gray-50 p-3 rounded-lg">
                  <label className="block text-xs font-medium text-gray-500 mb-1 uppercase tracking-wide">Duration</label>
                  <p className="text-lg font-semibold text-gray-900">{viewingService.duration} minutes</p>
                </div>
              )}
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

