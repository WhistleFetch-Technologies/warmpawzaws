'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { VendorServiceManagementComplete } from '@/components/vendor/VendorServiceManagementComplete';
import { VendorHeader } from '@/components/vendor/VendorHeader';

interface Service {
  id: string;
  service_name: string;
  description: string;
  category: string;
  price: number;
  duration_minutes: number;
  service_style: 'at_vendor' | 'at_home' | 'online';
  is_enabled: boolean;
  publish_status: 'draft' | 'published' | 'archived';
}

function ServiceManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [filter, setFilter] = useState<'all' | 'published' | 'draft' | 'enabled' | 'disabled'>('all');
  const [newService, setNewService] = useState<Partial<Service>>({
    service_style: 'at_vendor',
    is_enabled: true,
    publish_status: 'draft',
  });
  
  // Auto-open add form if ?add=true in URL
  useEffect(() => {
    if (searchParams.get('add') === 'true') {
      setShowAddForm(true);
    }
  }, [searchParams]);
  
  // Filter services based on selected filter
  const filteredServices = services.filter(service => {
    switch (filter) {
      case 'published': return service.publish_status === 'published';
      case 'draft': return service.publish_status === 'draft';
      case 'enabled': return service.is_enabled === true;
      case 'disabled': return service.is_enabled === false;
      default: return true;
    }
  });

  useEffect(() => {
    const vendorId = localStorage.getItem('vendorId');
    if (!vendorId) {
      router.push('/onboarding');
      return;
    }
    loadServices();
  }, [router]);

  const loadServices = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (vendorId) {
        const response = await apiClient.get<any>(`/vendor/${vendorId}/services`);
        
        // Handle multiple API response formats
        let loadedServices: Service[] = [];
        
        if (Array.isArray(response.services)) {
          // Format 1: { services: Service[] } - flat array
          loadedServices = response.services;
        } else if (response.services && typeof response.services === 'object') {
          // Format 2: { services: { at_home: { services: [] }, at_center: { services: [] }, tele: { services: [] } } }
          const nested = response.services;
          ['at_home', 'at_center', 'tele', 'at_vendor', 'online'].forEach(style => {
            if (nested[style]?.services && Array.isArray(nested[style].services)) {
              loadedServices = [...loadedServices, ...nested[style].services];
            } else if (Array.isArray(nested[style])) {
              loadedServices = [...loadedServices, ...nested[style]];
            }
          });
        } else if (Array.isArray(response.allServices)) {
          // Format 3: { allServices: Service[] }
          loadedServices = response.allServices;
        } else if (Array.isArray(response.legacyServices)) {
          // Format 4: { legacyServices: Service[] }
          loadedServices = response.legacyServices;
        } else if (Array.isArray(response)) {
          // Format 5: Direct array response
          loadedServices = response;
        }
        
        // Normalize field names (handle both snake_case and camelCase)
        loadedServices = loadedServices.map(s => ({
          ...s,
          id: s.id,
          service_name: s.service_name || s.serviceName || s.name || 'Unnamed Service',
          description: s.description || '',
          category: s.category || s.sub_category || 'General',
          price: s.price || s.custom_price || 0,
          duration_minutes: s.duration_minutes || s.custom_duration || 30,
          service_style: s.service_style || s.serviceStyle || 'at_vendor',
          is_enabled: s.is_enabled ?? s.isEnabled ?? true,
          publish_status: s.publish_status || s.publishStatus || 'draft',
        }));
        
        setServices(loadedServices);
      }
    } catch (err) {
      console.error('Error loading services:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddService = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.post(`/vendor/${vendorId}/services`, {
        ...newService,
      });
      setShowAddForm(false);
      setNewService({ service_style: 'at_vendor', is_enabled: true, publish_status: 'draft' });
      loadServices();
    } catch (err) {
      console.error('Error adding service:', err);
    }
  };

  const toggleServiceStatus = async (serviceId: string, isEnabled: boolean) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      await apiClient.put(`/vendor/${vendorId}/services/${serviceId}`, { is_enabled: !isEnabled });
      loadServices();
    } catch (err) {
      console.error('Error updating service:', err);
    }
  };

  const publishService = async (serviceId: string) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        console.error('Vendor ID not found');
        return;
      }
      await apiClient.put(`/vendor/${vendorId}/services/${serviceId}`, { publish_status: 'published' });
      loadServices();
    } catch (err) {
      console.error('Error publishing service:', err);
    }
  };
  
  const unpublishService = async (serviceId: string) => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        console.error('Vendor ID not found');
        return;
      }
      await apiClient.put(`/vendor/${vendorId}/services/${serviceId}`, { publish_status: 'draft' });
      loadServices();
    } catch (err) {
      console.error('Error unpublishing service:', err);
    }
  };

  const getStyleIcon = (style: string) => {
    switch (style) {
      case 'at_vendor': return '🏥';
      case 'at_home': return '🏠';
      case 'online': return '💻';
      default: return '📋';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Service Management"
          subtitle="Configure your services and pricing"
          onBack={() => router.back()}
          actions={[
            <button
              key="add"
              type="button"
              onClick={() => setShowAddForm(true)}
              className="whitespace-nowrap rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
            >
              + Add Service
            </button>,
          ]}
        />

        <div className="w-full px-4 py-6 sm:px-6">
        
        {/* Filter Bar */}
        {services.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-500 mr-2">Filter:</span>
            {[
              { value: 'all', label: 'All', count: services.length },
              { value: 'published', label: 'Published', count: services.filter(s => s.publish_status === 'published').length },
              { value: 'draft', label: 'Draft', count: services.filter(s => s.publish_status === 'draft').length },
              { value: 'enabled', label: 'Enabled', count: services.filter(s => s.is_enabled).length },
              { value: 'disabled', label: 'Disabled', count: services.filter(s => !s.is_enabled).length },
            ].map(({ value, label, count }) => (
              <button
                key={value}
                onClick={() => setFilter(value as any)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition ${
                  filter === value
                    ? 'bg-orange-500 text-white'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {label} ({count})
              </button>
            ))}
          </div>
        )}

        {services.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-6xl mb-4">🛠️</div>
            <p className="text-gray-500">No services configured yet</p>
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              Add Your First Service
            </button>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-gray-500">No services match the selected filter</p>
            <button
              onClick={() => setFilter('all')}
              className="mt-4 px-6 py-2 text-orange-500 hover:underline"
            >
              Show all services
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((service) => (
              <div key={service.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xl">{getStyleIcon(service.service_style)}</span>
                      <h3 className="font-semibold text-gray-800">{service.service_name}</h3>
                    </div>
                    <p className="text-sm text-gray-500">{service.category}</p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      service.publish_status === 'published'
                        ? 'bg-green-100 text-green-700'
                        : service.publish_status === 'draft'
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {service.publish_status}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      service.is_enabled ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {service.is_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{service.description}</p>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">Price</span>
                    <p className="font-semibold text-orange-600">₹{service.price}</p>
                  </div>
                  <div>
                    <span className="text-gray-500">Duration</span>
                    <p className="font-medium">{service.duration_minutes} mins</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <button
                    onClick={() => toggleServiceStatus(service.id, service.is_enabled)}
                    className={`flex-1 p-2 rounded-lg text-sm font-medium ${
                      service.is_enabled
                        ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        : 'bg-green-100 text-green-600 hover:bg-green-200'
                    }`}
                  >
                    {service.is_enabled ? 'Disable' : 'Enable'}
                  </button>
                  {service.publish_status === 'draft' ? (
                    <button
                      onClick={() => publishService(service.id)}
                      className="flex-1 p-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
                    >
                      Publish
                    </button>
                  ) : service.publish_status === 'published' ? (
                    <button
                      onClick={() => unpublishService(service.id)}
                      className="flex-1 p-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                      Unpublish
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <h2 className="text-xl font-semibold mb-4">Add New Service</h2>
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Service Name"
                  value={newService.service_name || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewService({ ...newService, service_name: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <textarea
                  placeholder="Description"
                  value={newService.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewService({ ...newService, description: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                  rows={3}
                />
                <input
                  type="text"
                  placeholder="Category"
                  value={newService.category || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewService({ ...newService, category: e.target.value })}
                  className="w-full p-3 border rounded-lg"
                />
                <div className="grid grid-cols-2 gap-4">
                  <input
                    type="number"
                    placeholder="Price (₹)"
                    value={newService.price || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewService({ ...newService, price: parseFloat(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                  <input
                    type="number"
                    placeholder="Duration (mins)"
                    value={newService.duration_minutes || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewService({ ...newService, duration_minutes: parseInt(e.target.value) })}
                    className="w-full p-3 border rounded-lg"
                  />
                </div>
                <select
                  value={newService.service_style}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewService({ ...newService, service_style: e.target.value as any })}
                  className="w-full p-3 border rounded-lg"
                >
                  <option value="at_vendor">At Clinic/Centre</option>
                  <option value="at_home">Home Visit</option>
                  <option value="online">Online/Tele</option>
                </select>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddService}
                  className="flex-1 p-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
                >
                  Add Service
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

export default function ServiceManagementPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [vendorData, setVendorData] = useState<any>(null);
  const [useFullFlow, setUseFullFlow] = useState<boolean | null>(null);

  useEffect(() => {
    const storedId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null;
    const storedData = typeof window !== 'undefined' ? localStorage.getItem('vendorData') : null;
    if (!storedId) {
      setUseFullFlow(false);
      return;
    }
    setVendorId(storedId);
    let parsed: any = {};
    try {
      if (storedData) parsed = JSON.parse(storedData);
    } catch { /* ignore */ }
    apiClient.get(`/vendor/profile`).then((r: any) => {
      const v = r?.vendor || r?.data?.vendor || r?.data || parsed;
      const data = { ...parsed, ...v, id: v?.id || storedId };
      setVendorData(data);
      setUseFullFlow(true);
    }).catch(() => {
      setVendorData({ ...parsed, id: storedId });
      setUseFullFlow(true);
    });
  }, []);

  if (useFullFlow === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (useFullFlow === true && vendorId && vendorData) {
    return (
      <VendorServiceManagementComplete
        vendorId={vendorId}
        vendorData={vendorData}
        onBack={() => router.push('/')}
      />
    );
  }

  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    }>
      <ServiceManagementContent />
    </Suspense>
  );
}
