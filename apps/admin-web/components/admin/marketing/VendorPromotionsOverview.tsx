'use client';

import { useState, useEffect } from 'react';
import {
  Tag, Search, Filter, ChevronDown, Eye, ToggleLeft, ToggleRight,
  Zap, Calendar, Gift, Package, Users, Clock, Store, Scissors,
  Stethoscope, TrendingUp, BarChart, RefreshCw, ExternalLink
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { Card, Badge, Input, Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@warmpawz/ui';

interface VendorPromotion {
  id: string;
  vendor_id: string;
  vendor_name?: string;
  vendor_phone?: string;
  name: string;
  description: string;
  code?: string;
  promotion_type: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  usage_count?: number;
  usage_limit?: number;
  promo_category: 'product' | 'service';
  views?: number;
  conversions?: number;
  created_at: string;
}

interface VendorPromotionsOverviewProps {
  onBack?: () => void;
}

const PROMO_TYPES = [
  { id: 'flash_sale', label: 'Flash Sale', icon: Zap, color: 'rose' },
  { id: 'seasonal', label: 'Seasonal', icon: Calendar, color: 'amber' },
  { id: 'buy_x_get_y', label: 'BOGO', icon: Gift, color: 'purple' },
  { id: 'bundle', label: 'Bundle', icon: Package, color: 'teal' },
  { id: 'combo', label: 'Combo', icon: Package, color: 'teal' },
  { id: 'first_order', label: 'First Order', icon: Users, color: 'blue' },
  { id: 'first_booking', label: 'First Booking', icon: Users, color: 'blue' },
  { id: 'loyalty', label: 'Loyalty', icon: Gift, color: 'violet' },
];

export function VendorPromotionsOverview({ onBack }: VendorPromotionsOverviewProps) {
  const [promotions, setPromotions] = useState<VendorPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, product: 0, service: 0 });
  const [filter, setFilter] = useState({
    status: 'all',
    category: 'all',
    type: 'all',
    search: ''
  });

  useEffect(() => {
    loadPromotions();
  }, [filter.status, filter.category, filter.type]);

  const loadPromotions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.status !== 'all') params.append('status', filter.status);
      if (filter.category !== 'all') params.append('category', filter.category);
      if (filter.type !== 'all') params.append('type', filter.type);
      
      const res = await apiClient.get<any>(`/admin/vendor-promotions?${params.toString()}`);
      setPromotions(res?.promotions || []);
      setStats(res?.stats || { total: 0, active: 0, product: 0, service: 0 });
    } catch (error) {
      console.error('Error loading vendor promotions:', error);
      toast.error('Failed to load vendor promotions');
    } finally {
      setLoading(false);
    }
  };

  const togglePromotion = async (promo: VendorPromotion) => {
    try {
      await apiClient.put(`/admin/vendor-promotions/${promo.id}/toggle`, {
        category: promo.promo_category,
        is_active: !promo.is_active
      });
      toast.success(`Promotion ${!promo.is_active ? 'activated' : 'deactivated'}`);
      loadPromotions();
    } catch (error) {
      toast.error('Failed to update promotion');
    }
  };

  const getPromoTypeConfig = (type: string) => {
    return PROMO_TYPES.find(t => t.id === type) || { id: type, label: type, icon: Tag, color: 'gray' };
  };

  const filteredPromotions = promotions.filter(p => {
    if (filter.search) {
      const search = filter.search.toLowerCase();
      return p.name.toLowerCase().includes(search) ||
             p.code?.toLowerCase().includes(search) ||
             p.vendor_name?.toLowerCase().includes(search);
    }
    return true;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Vendor Promotions</h2>
          <p className="text-slate-500 mt-1">View and manage all vendor-created promotions</p>
        </div>
        <Button onClick={loadPromotions} variant="outline" className="flex items-center gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-lg">
              <Tag className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-lg">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-100 rounded-lg">
              <Store className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Product Promos</p>
              <p className="text-xl font-bold text-orange-600">{stats.product}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-lg">
              <Scissors className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Service Promos</p>
              <p className="text-xl font-bold text-purple-600">{stats.service}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name, code, or vendor..."
                value={filter.search}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select value={filter.status} onValueChange={(v) => setFilter({ ...filter, status: v })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filter.category} onValueChange={(v) => setFilter({ ...filter, category: v })}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="product">Products</SelectItem>
              <SelectItem value="service">Services</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={filter.type} onValueChange={(v) => setFilter({ ...filter, type: v })}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {PROMO_TYPES.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Promotions Table */}
      <Card>
        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
            <p className="mt-4 text-slate-500">Loading promotions...</p>
          </div>
        ) : filteredPromotions.length === 0 ? (
          <div className="p-12 text-center">
            <Tag className="w-12 h-12 mx-auto mb-4 text-slate-300" />
            <p className="text-slate-600 font-medium">No vendor promotions found</p>
            <p className="text-sm text-slate-400 mt-1">Vendors haven't created any promotions yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Promotion</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Vendor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Discount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Validity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Usage</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPromotions.map(promo => {
                  const typeConfig = getPromoTypeConfig(promo.promotion_type);
                  const TypeIcon = typeConfig.icon;
                  const isLive = promo.is_active && new Date(promo.start_date) <= new Date() && new Date(promo.end_date) >= new Date();
                  
                  return (
                    <tr key={promo.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-900">{promo.name}</p>
                          {promo.code && (
                            <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{promo.code}</code>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-slate-700">{promo.vendor_name || 'Unknown'}</p>
                          <p className="text-xs text-slate-400">{promo.vendor_phone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <TypeIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">{typeConfig.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">
                          {promo.discount_value}{promo.discount_type === 'percentage' ? '%' : '₹'}
                        </span>
                        <span className="text-slate-400 ml-1">OFF</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={promo.promo_category === 'product' ? 'secondary' : 'outline'}>
                          {promo.promo_category === 'product' ? (
                            <><Store className="w-3 h-3 mr-1" />Product</>
                          ) : (
                            <><Scissors className="w-3 h-3 mr-1" />Service</>
                          )}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(promo.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-400">
                            to {new Date(promo.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm">
                          <span className="font-medium text-slate-900">{promo.usage_count || 0}</span>
                          {promo.usage_limit && (
                            <span className="text-slate-400">/{promo.usage_limit}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isLive ? (
                          <Badge variant="default" className="bg-emerald-500">
                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse mr-1.5"></span>
                            Live
                          </Badge>
                        ) : promo.is_active ? (
                          <Badge variant="outline">Scheduled</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => togglePromotion(promo)}
                            className={`p-2 rounded-lg transition-colors ${
                              promo.is_active
                                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                            }`}
                            title={promo.is_active ? 'Deactivate' : 'Activate'}
                          >
                            {promo.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

export default VendorPromotionsOverview;
