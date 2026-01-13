'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye, X } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from './StatusBadge';
import { AddServiceModal } from './AddServiceModal';

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
        <div className="space-y-3 bg-white">
          {filteredServices.map((service) => (
            <div key={service.id} className="bg-white border border-gray-300 rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-semibold text-gray-900">{service.name}</h4>
                    <StatusBadge status={service.status} />
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full border border-gray-300">
                      {service.category}
                    </span>
                  </div>
                  
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      Price: <span className="font-semibold text-gray-900">₹{service.price}</span>
                    </span>
                    <span className="text-gray-500">
                      Created: {service.createdAt ? new Date(service.createdAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-gray-300 text-gray-900 hover:bg-gray-100"
                    onClick={() => handleViewService(service)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-gray-300 text-gray-900 hover:bg-gray-100"
                    onClick={() => handleEditService(service)}
                  >
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="border-red-300 text-red-600 hover:bg-red-50"
                    onClick={() => handleDeleteService(service)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white">
              <h3 className="text-xl font-semibold text-gray-900">Service Details</h3>
              <button
                onClick={() => {
                  setViewModalOpen(false);
                  setViewingService(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name</label>
                <p className="text-gray-900 font-semibold">{viewingService.name}</p>
              </div>

              {viewingService.description && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <p className="text-gray-600">{viewingService.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <p className="text-gray-900">{viewingService.category}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <StatusBadge status={viewingService.status} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price</label>
                  <p className="text-gray-900 font-semibold">₹{viewingService.price}</p>
                </div>
                {viewingService.duration && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Duration</label>
                    <p className="text-gray-900">{viewingService.duration} minutes</p>
                  </div>
                )}
              </div>

              {viewingService.serviceType && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Service Type</label>
                  <p className="text-gray-900">{viewingService.serviceType}</p>
                </div>
              )}

              {viewingService.applicableRoles && viewingService.applicableRoles.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Applicable Roles</label>
                  <div className="flex flex-wrap gap-2">
                    {viewingService.applicableRoles.map((role, idx) => (
                      <span key={idx} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Created Date</label>
                <p className="text-gray-600">
                  {viewingService.createdAt ? new Date(viewingService.createdAt).toLocaleString() : 'N/A'}
                </p>
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setViewModalOpen(false);
                  setViewingService(null);
                }}
              >
                Close
              </Button>
              <Button
                className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white"
                onClick={() => {
                  setViewModalOpen(false);
                  handleEditService(viewingService);
                }}
              >
                <Edit className="w-4 h-4 mr-2" />
                Edit Service
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

