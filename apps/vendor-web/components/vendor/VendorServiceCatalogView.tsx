'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Check, Search, X, CheckSquare, Square } from 'lucide-react';
import { apiClient } from '@/lib/api-client';

interface VendorServiceCatalogViewProps {
  vendorId: string;
  vendorData: any;
  onBack: () => void;
  onSelectService?: (service: any) => void;
  mode?: 'browse' | 'multi-select';
}

interface ServiceCatalogItem {
  catalogId?: string;
  serviceId?: string;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  serviceName: string;
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  applicableRoles: string[];
  basePrice: number;
  isPackage: boolean;
  description: string;
  duration?: number;
}

export function VendorServiceCatalogView({ 
  vendorId, 
  vendorData, 
  onBack,
  onSelectService,
  mode = 'browse'
}: VendorServiceCatalogViewProps) {
  const [services, setServices] = useState<ServiceCatalogItem[]>([]);
  const [vendorServices, setVendorServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStyle, setActiveStyle] = useState<'all' | 'at_home' | 'at_center' | 'tele'>('all');
  const [selectedServices, setSelectedServices] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadCatalogData();
  }, [vendorId]);

  useEffect(() => {
    filterServices();
  }, [services, searchQuery, activeStyle, vendorData]);

  const loadCatalogData = async () => {
    try {
      setLoading(true);
      const roleId = vendorData?.roleId || vendorData?.role_id;
      
      const response = await apiClient.get<any>(`/service-catalog/role/${roleId}`);
      if (response.success && response.services) {
        setServices(response.services);
      }

      const vendorResponse = await apiClient.get<any>(`/vendor/${vendorId}/services`);
      if (vendorResponse.success) {
        const allVendorServices = vendorResponse.allServices || [];
        setVendorServices(allVendorServices);
      }
    } catch (error) {
      console.error('Error loading catalog:', error);
    } finally {
      setLoading(false);
    }
  };

  const filterServices = () => {
    // Filtering logic handled in component render
  };

  const isServiceEnabled = (serviceId: string) => {
    return vendorServices.some(vs => vs.serviceId === serviceId || vs.id === serviceId);
  };

  const handleToggleService = (service: ServiceCatalogItem) => {
    if (mode === 'multi-select') {
      const newSelected = new Set(selectedServices);
      if (newSelected.has(service.serviceId || service.catalogId || '')) {
        newSelected.delete(service.serviceId || service.catalogId || '');
      } else {
        newSelected.add(service.serviceId || service.catalogId || '');
      }
      setSelectedServices(newSelected);
    } else if (onSelectService) {
      onSelectService(service);
    }
  };

  const handleAddSelected = async () => {
    if (selectedServices.size === 0) return;
    
    try {
      setAdding(true);
      const servicesToAdd = Array.from(selectedServices);
      await Promise.all(
        servicesToAdd.map(serviceId => {
          const service = services.find(s => (s.serviceId || s.catalogId) === serviceId);
          if (!service) return Promise.resolve();
          
          return apiClient.post(`/vendor/${vendorId}/services`, {
            serviceId: service.serviceId || service.catalogId,
            serviceStyle: service.serviceStyle,
            isEnabled: true,
            publishStatus: 'published'
          });
        })
      );
      alert('✅ Services added successfully!');
      setSelectedServices(new Set());
      loadCatalogData();
    } catch (error: any) {
      alert(error.message || 'Failed to add services');
    } finally {
      setAdding(false);
    }
  };

  const filteredServices = services.filter(service => {
    if (activeStyle !== 'all' && service.serviceStyle !== activeStyle) return false;
    if (searchQuery && !service.serviceName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const groupedByCategory = filteredServices.reduce((acc, service) => {
    const category = service.categoryName || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {} as Record<string, ServiceCatalogItem[]>);

  return (
    <div className="min-h-screen bg-gray-50 w-full max-w-[430px] mx-auto">
      <div className="bg-white border-b sticky top-0 z-10 p-4">
        <div className="flex items-center gap-0 mb-4">
          <button onClick={onBack} className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="font-semibold text-gray-900">Service Catalog</h1>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-0/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            placeholder="Search services..."
            className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
          />
        </div>

        <div className="flex gap-0">
          {['all', 'at_home', 'at_center', 'tele'].map((style) => (
            <button
              key={style}
              onClick={() => setActiveStyle(style as any)}
              className={`px-0 py-0 rounded-lg text-sm font-medium ${
                activeStyle === style
                  ? 'bg-[#FF8C42] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {style === 'all' ? 'All' : style === 'at_home' ? 'Home' : style === 'at_center' ? 'Center' : 'Tele'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF8C42]"></div>
        </div>
      ) : (
        <div className="p-4 space-y-6">
          {Object.entries(groupedByCategory).map(([category, categoryServices]) => (
            <div key={category}>
              <h2 className="font-semibold text-gray-900 mb-0">{category}</h2>
              <div className="space-y-2">
                {categoryServices.map((service) => {
                  const serviceId = service.serviceId || service.catalogId || '';
                  const isEnabled = isServiceEnabled(serviceId);
                  const isSelected = selectedServices.has(serviceId);

                  return (
                    <div
                      key={serviceId}
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${
                        isSelected ? 'border-[#FF8C42] bg-orange-50' : 'border-gray-200'
                      }`}
                      onClick={() => handleToggleService(service)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{service.serviceName}</h3>
                          <p className="text-sm text-gray-600 mt-0">{service.description}</p>
                          <div className="flex items-center gap-0 mt-0">
                            <span className="text-sm font-medium text-[#FF8C42]">₹{service.basePrice}</span>
                            <span className="text-xs text-gray-500">{service.duration || 30} mins</span>
                          </div>
                        </div>
                        {mode === 'multi-select' && (
                          <div className="ml-4">
                            {isSelected ? (
                              <CheckSquare className="w-5 h-5 text-[#FF8C42]" />
                            ) : (
                              <Square className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                        )}
                        {isEnabled && (
                          <span className="ml-4 px-0 py-0 bg-green-100 text-green-700 rounded text-xs font-medium">
                            Enabled
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === 'multi-select' && selectedServices.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 max-w-[430px] mx-auto">
          <button
            onClick={handleAddSelected}
            disabled={adding}
            className="w-full bg-[#FF8C42] text-white py-0 rounded-xl font-medium disabled:opacity-50"
          >
            {adding ? 'Adding...' : `Add ${selectedServices.size} Service${selectedServices.size > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

