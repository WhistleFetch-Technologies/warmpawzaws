'use client';

import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Package } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';
import { StatusBadge } from './StatusBadge';

interface ProductService {
  id: string;
  name: string;
  type: 'product' | 'service';
  category: string;
  price: number;
  stock?: number;
  status: 'active' | 'inactive' | 'draft' | 'archived' | 'pending';
  description?: string;
  createdAt: string;
}

export function ProductServicesTab() {
  const [items, setItems] = useState<ProductService[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/catalog/product-services');
      setItems(data.items || []);
    } catch (error) {
      console.error('Error loading product/services:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (typeFilter !== 'all' && item.type !== typeFilter) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return <div className="p-0 text-center text-gray-500">Loading items...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex-1 flex gap-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-0/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search products/services..."
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              className="w-full pl-0 pr-4 py-0 border border-gray-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value as any)}
            className="px-0 py-0 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Types</option>
            <option value="product">Products</option>
            <option value="service">Services</option>
          </select>
        </div>
        <Button className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
          <Plus className="w-4 h-4 mr-0" />
          Add Item
        </Button>
      </div>

      {filteredItems.length === 0 ? (
        <div className="p-0 text-center text-gray-500">No items found</div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-0 mb-0">
                    <Package className="w-5 h-5 text-gray-400" />
                    <h4 className="font-semibold text-gray-900">{item.name}</h4>
                    <StatusBadge status={item.status} />
                    <span className="px-0 py-0 text-xs bg-blue-100 text-blue-700 rounded-full">
                      {item.type}
                    </span>
                    <span className="px-0 py-0 text-xs bg-gray-100 text-gray-700 rounded-full">
                      {item.category}
                    </span>
                  </div>
                  
                  {item.description && (
                    <p className="text-sm text-gray-600 mb-0">{item.description}</p>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      Price: <span className="font-semibold text-gray-900">₹{item.price}</span>
                    </span>
                    {item.stock !== undefined && (
                      <span className="text-gray-600">
                        Stock: <span className="font-semibold text-gray-900">{item.stock}</span>
                      </span>
                    )}
                    <span className="text-gray-500">
                      Created: {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                <div className="flex gap-0 ml-4">
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

