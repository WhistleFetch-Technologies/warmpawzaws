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
      const data = await apiClient.get<any>('/admin/catalog/services');
      setServices(data.services || []);
    } catch (error) {
      console.error('Error loading services:', error);
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
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-0/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search services..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
          <Plus className="w-4 h-4 mr-0" />
          Add Service
        </Button>
      </div>

      {filteredServices.length === 0 ? (
        <div className="p-0 text-center text-gray-500">No services found</div>
      ) : (
        <div className="space-y-3">
          {filteredServices.map((service) => (
            <div key={service.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-0 mb-0">
                    <h4 className="font-semibold text-gray-900">{service.name}</h4>
                    <StatusBadge status={service.status} />
                    <span className="px-0 py-0 text-xs bg-gray-100 text-gray-700 rounded-full">
                      {service.category}
                    </span>
                  </div>
                  
                  {service.description && (
                    <p className="text-sm text-gray-600 mb-0">{service.description}</p>
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
                
                <div className="flex gap-0 ml-4">
                  <Button size="sm" variant="outline">
                    <Eye className="w-4 h-4 mr-0" />
                    View
                  </Button>
                  <Button size="sm" variant="outline">
                    <Edit className="w-4 h-4 mr-0" />
                    Edit
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4 mr-0" />
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

