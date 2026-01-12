'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from './StatusBadge';

interface Service {
  id: string;
  name: string;
  category: string;
  status: 'active' | 'inactive' | 'pending' | 'draft';
  price: number;
  description?: string;
  createdAt: string;
}

export function ServiceCatalogTab() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      // Try multiple endpoints to find the correct one
      let data: any = null;
      try {
        // First try the service catalog endpoint by role (get all roles' catalogs)
        const roles = await apiClient.get<any>('/admin/roles');
        if (roles.roles && roles.roles.length > 0) {
          // Get services for first role as example, or aggregate all
          const allServices: any[] = [];
          for (const role of roles.roles.slice(0, 5)) { // Limit to first 5 roles for performance
            try {
              const roleServices = await apiClient.get<any>(`/service-catalog/role/${role.code || role.name}`);
              if (roleServices.data && Array.isArray(roleServices.data)) {
                allServices.push(...roleServices.data.map((s: any) => ({
                  id: s.id || s.service_id,
                  name: s.service_name || s.display_name || s.name,
                  category: s.category_name || s.category_id || 'General',
                  status: s.status === 'active' ? 'active' : s.publish_status === 'published' ? 'active' : 'inactive',
                  price: s.base_price || 0,
                  description: s.description,
                  createdAt: s.created_at || new Date().toISOString(),
                })));
              }
            } catch (err) {
              console.warn(`Error loading services for role ${role.code}:`, err);
            }
          }
          setServices(allServices);
          return;
        }
      } catch (err) {
        console.warn('Error loading via role-based endpoint:', err);
      }
      
      // Fallback to direct service catalog endpoint
      try {
        data = await apiClient.get<any>('/service-catalog');
        if (data.data && Array.isArray(data.data)) {
          setServices(data.data.map((s: any) => ({
            id: s.id || s.service_id,
            name: s.service_name || s.display_name || s.name,
            category: s.category_name || s.category_id || 'General',
            status: s.status === 'active' ? 'active' : s.publish_status === 'published' ? 'active' : 'inactive',
            price: s.base_price || 0,
            description: s.description,
            createdAt: s.created_at || new Date().toISOString(),
          })));
        } else {
          setServices(data.services || data || []);
        }
      } catch (fallbackErr) {
        console.error('Error loading services from fallback endpoint:', fallbackErr);
        setServices([]);
      }
    } catch (error) {
      console.error('Error loading services:', error);
      setServices([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter(service =>
    service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="p-0 text-center text-gray-500">Loading services...</div>;
  }

  return (
    <div className="bg-white p-6 rounded-lg">
      <div className="flex items-center justify-between mb-6 bg-white pb-4 border-b border-gray-300">
        <h2 className="text-2xl font-bold text-gray-900">Service Catalog</h2>
        <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E] text-white border-0">
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
                      Created: {new Date(service.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-2 ml-4">
                  <Button size="sm" variant="outline" className="border-gray-300 text-gray-900 hover:bg-gray-100">
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button size="sm" variant="outline" className="border-gray-300 text-gray-900 hover:bg-gray-100">
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

