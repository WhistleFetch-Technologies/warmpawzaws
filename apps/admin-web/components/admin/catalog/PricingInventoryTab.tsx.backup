'use client';

import { useState, useEffect } from 'react';
import { Search, Edit, DollarSign, Package } from 'lucide-react';
import { Button } from '@warmpawz/ui';
import { apiClient } from '@/lib/api-client';

interface PricingItem {
  id: string;
  name: string;
  category: string;
  basePrice: number;
  currentPrice: number;
  discount?: number;
  stock: number;
  minStock: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export function PricingInventoryTab() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<any>('/admin/catalog/pricing-inventory');
      setItems(data.items || []);
    } catch (error) {
      console.error('Error loading pricing/inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div className="p-6 text-center text-gray-500">Loading pricing and inventory...</div>;
  }

  return (
    <div>
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="p-6 text-center text-gray-500">No items found</div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => {
            const isLowStock = item.stock <= item.minStock;
            
            return (
              <div key={item.id} className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow ${
                isLowStock ? 'border-orange-300 bg-orange-50/30' : ''
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-semibold text-gray-900">{item.name}</h4>
                      <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                        {item.category}
                      </span>
                      {isLowStock && (
                        <span className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded-full">
                          Low Stock
                        </span>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Base Price:</span>
                        <span className="ml-2 font-semibold text-gray-900">₹{item.basePrice}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Current Price:</span>
                        <span className="ml-2 font-semibold text-green-600">₹{item.currentPrice}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Stock:</span>
                        <span className={`ml-2 font-semibold ${
                          isLowStock ? 'text-orange-600' : 'text-gray-900'
                        }`}>
                          {item.stock}
                        </span>
                      </div>
                      {item.discount && (
                        <div>
                          <span className="text-gray-600">Discount:</span>
                          <span className="ml-2 font-semibold text-red-600">{item.discount}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 ml-4">
                    <Button size="sm" variant="outline">
                      <Edit className="w-4 h-4 mr-1" />
                      Edit Pricing
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

