import { useState, useEffect } from 'react';
import { Eye, Edit } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../../utils/api-config';

interface PricingItem {
  id: string;
  name: string;
  category: string;
  currentPrice: number;
  originalPrice: number | null;
  margin: string;
  stockLevel: number | string;
  lastUpdated: string;
}

export function PricingInventoryTab() {
  const [items, setItems] = useState<PricingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    avgPrice: 0,
    lowStock: 0,
    outOfStock: 0,
    totalValue: 0
  });

  useEffect(() => {
    loadPricingData();
  }, []);

  const loadPricingData = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(
        `${getApiBaseUrl()}/admin/catalog/pricing`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        console.log('Pricing data loaded:', data);
        setItems(data.items || []);
        setStats(data.stats || stats);
      }
    } catch (error) {
      console.error('Error loading pricing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (statusFilter !== 'all') {
      if (statusFilter === 'critical' && item.stockLevel !== 0 && item.stockLevel !== '∞') return false;
    }
    if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div>
      <p className="text-sm text-gray-600 mb-4">Manage pricing strategies and inventory levels</p>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl text-blue-600 mb-1">₹{stats.avgPrice.toLocaleString('en-IN')}</div>
          <div className="text-sm text-gray-600">Average service price</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl text-orange-600 mb-1">{stats.lowStock}</div>
          <div className="text-sm text-gray-600">Low stock items</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl text-red-600 mb-1">{stats.outOfStock}</div>
          <div className="text-sm text-gray-600">Out of stock</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 text-center">
          <div className="text-3xl text-green-600 mb-1">₹{stats.totalValue.toLocaleString('en-IN')}</div>
          <div className="text-sm text-gray-600">Total Inventory Value</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Status</span>
          <select 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Status</option>
            <option value="critical">Critical Stock Issues</option>
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Category</span>
          <select 
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            <option value="Veterinary Services">Veterinary Services</option>
            <option value="Basic Grooming">Basic Grooming</option>
            <option value="Pet Food">Pet Food</option>
          </select>
        </div>

        <div className="flex-1" />

        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            className="pl-3 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm w-64"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          Sort-by
        </button>
        <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          Bulk Actions
        </button>
        <button className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">
          Filters
        </button>
      </div>

      <p className="text-sm text-gray-600 mb-4">Monitor and adjust pricing across all products and services</p>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 px-4 py-2 bg-gray-50 rounded-lg text-xs text-gray-600 mb-2">
        <div className="col-span-3">Item</div>
        <div className="col-span-2">Current Price</div>
        <div className="col-span-2">Original Price</div>
        <div className="col-span-1">Margin</div>
        <div className="col-span-2">Stock level</div>
        <div className="col-span-1">Last Updated</div>
        <div className="col-span-1">Actions</div>
      </div>

      {/* Items List */}
      <div className="space-y-2">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">Loading pricing data...</div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-sm">No pricing data found</div>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div key={item.id} className="grid grid-cols-12 gap-4 px-4 py-3 bg-white rounded-lg border border-gray-200 items-center hover:bg-gray-50">
              <div className="col-span-3">
                <div className="text-sm">{item.name}</div>
                <div className="text-xs text-gray-500">{item.category}</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm">₹{item.currentPrice.toLocaleString('en-IN')}</div>
              </div>
              
              <div className="col-span-2">
                <div className="text-sm">
                  {item.originalPrice ? `₹${item.originalPrice.toLocaleString('en-IN')}` : '-'}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className={`text-sm ${item.margin ? 'text-green-600' : ''}`}>
                  {item.margin || '-'}
                </div>
              </div>
              
              <div className="col-span-2">
                <div className={`text-sm ${
                  item.stockLevel === 0 ? 'text-red-600' : 
                  item.stockLevel === '∞' ? 'text-gray-600' : 
                  'text-gray-900'
                }`}>
                  {item.stockLevel === '∞' ? '∞' : item.stockLevel}
                </div>
              </div>
              
              <div className="col-span-1">
                <div className="text-xs">{item.lastUpdated}</div>
              </div>
              
              <div className="col-span-1 flex items-center gap-2">
                <button className="p-1 hover:bg-blue-50 rounded">
                  <Eye className="w-4 h-4 text-blue-600" />
                </button>
                <button className="p-1 hover:bg-green-50 rounded">
                  <Edit className="w-4 h-4 text-green-600" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
