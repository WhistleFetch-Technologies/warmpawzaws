'use client';

import { useState, useEffect } from 'react';
import { 
  Tag, Plus, Edit2, Trash2, Calendar, Percent, Gift, Zap, Clock, 
  CheckCircle, XCircle, Search, Package, Users, ShoppingBag, 
  Sparkles, Target, TrendingUp, Copy, Eye, ToggleLeft, ToggleRight,
  ChevronDown, ChevronUp, Filter, ArrowRight, Info, AlertCircle
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import {
  formatRevenueStat,
  getEffectivePromotionStatus,
  getEffectiveStatusLabel,
  getToggleLabel,
  isPromotionLiveForFilter,
  sumNumeric,
} from '@/lib/promotion-stats';
import {
  parseJsonbArray,
  productScopeLabel,
  usesApplicableProducts,
  usesBundleProducts,
} from '@/lib/promotion-form-utils';
import { PromotionProductPicker } from './PromotionProductPicker';

// Promotion types with icons and descriptions
const PROMOTION_TYPES = [
  { 
    id: 'flash_sale', 
    name: 'Flash Sale', 
    icon: Zap, 
    color: 'from-rose-500 to-pink-500',
    description: 'Limited-time discount to create urgency',
    example: 'e.g., 24-hour 30% off sale'
  },
  { 
    id: 'seasonal', 
    name: 'Seasonal Sale', 
    icon: Calendar, 
    color: 'from-amber-500 to-orange-500',
    description: 'Weekend, holiday, or seasonal promotions',
    example: 'e.g., Summer Sale, Diwali Offer'
  },
  { 
    id: 'buy_x_get_y', 
    name: 'Buy X Get Y', 
    icon: Gift, 
    color: 'from-purple-500 to-indigo-500',
    description: 'BOGO offers and quantity deals',
    example: 'e.g., Buy 2 Get 1 Free'
  },
  { 
    id: 'bundle', 
    name: 'Combo Deal', 
    icon: Package, 
    color: 'from-teal-500 to-emerald-500',
    description: 'Discount on product combinations',
    example: 'e.g., Buy food + treats = 15% off'
  },
  { 
    id: 'first_order', 
    name: 'First Order', 
    icon: Users, 
    color: 'from-blue-500 to-cyan-500',
    description: 'Special discount for new customers',
    example: 'e.g., 20% off first purchase'
  },
  { 
    id: 'category_discount', 
    name: 'Category Discount', 
    icon: Tag, 
    color: 'from-slate-500 to-zinc-500',
    description: 'Discount on entire product category',
    example: 'e.g., All toys 25% off'
  },
];

interface PromotionsManagementProps {
  sellerId: string;
}

interface Promotion {
  id: string;
  name: string;
  description: string;
  code?: string;
  promotion_type: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_value?: number;
  max_discount_amount?: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  usage_limit?: number;
  usage_count?: number;
  target_audience?: 'all' | 'new_users' | 'returning_users';
  applicable_products?: string[];
  applicable_categories?: string[];
  // BOGO specific
  buy_quantity?: number;
  get_quantity?: number;
  get_discount_percent?: number;
  // Bundle specific
  bundle_products?: string[];
  bundle_discount?: number;
  // Analytics
  views?: number;
  conversions?: number;
  revenue_generated?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category?: string;
}

export function PromotionsManagement({ sellerId }: PromotionsManagementProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<Promotion | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, [sellerId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [promosRes, productsRes] = await Promise.all([
        apiClient.get<{ promotions?: Promotion[] }>(`/vendor/${sellerId}/promotions`),
        apiClient.get<{ products?: Product[] }>(`/vendor/${sellerId}/products`).catch(() => ({ products: [] }))
      ]);
      
      setPromotions(promosRes?.promotions || []);
      const prods = (productsRes as any)?.products || [];
      setProducts(prods);
      
      // Extract unique categories
      const cats = [...new Set(prods.map((p: Product) => p.category).filter(Boolean))] as string[];
      setCategories(cats);
    } catch (error) {
      console.error('Error loading promotions:', error);
      setPromotions([]);
    } finally {
      setLoading(false);
    }
  };

  const deletePromotion = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    try {
      await apiClient.delete(`/vendor/${sellerId}/promotions/${id}`);
      toast.success('Promotion deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete promotion');
    }
  };

  const togglePromotion = async (id: string, currentStatus: boolean) => {
    try {
      await apiClient.put(`/vendor/${sellerId}/promotions/${id}`, { is_active: !currentStatus });
      setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      toast.success(`Promotion ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update promotion');
    }
  };

  const duplicatePromotion = (promo: Promotion) => {
    setEditingPromo({
      ...promo,
      id: undefined as any,
      name: `${promo.name} (Copy)`,
      code: promo.code ? `${promo.code}COPY` : undefined
    });
    setShowAddModal(true);
  };

  // Filter promotions
  const filteredPromotions = promotions.filter(p => {
    const now = new Date();
    const effective = getEffectivePromotionStatus(p, now);

    if (filter === 'active' && effective !== 'live') return false;
    if (filter === 'scheduled' && effective !== 'scheduled') return false;
    if (filter === 'expired' && effective !== 'expired') return false;
    
    // Type filter
    if (typeFilter !== 'all' && p.promotion_type !== typeFilter) return false;
    
    // Search
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.code?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  const stats = {
    total: promotions.length,
    active: promotions.filter(p => isPromotionLiveForFilter(p)).length,
    scheduled: promotions.filter(p => getEffectivePromotionStatus(p) === 'scheduled').length,
    expired: promotions.filter(p => getEffectivePromotionStatus(p) === 'expired').length,
    totalConversions: sumNumeric(promotions.map(p => p.usage_count ?? p.conversions)),
    totalRevenue: sumNumeric(promotions.map(p => p.revenue_generated)),
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-orange-200 border-t-orange-500 mx-auto"></div>
          <p className="mt-4 text-slate-500">Loading promotions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Promotions & Offers</h1>
          <p className="text-slate-500 mt-1">Create discounts, flash sales, BOGO offers & more</p>
        </div>
        <button
          onClick={() => {
            setEditingPromo(null);
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-2 px-5 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
        >
          <Plus className="w-5 h-5" />
          Create Promotion
        </button>
      </div>

      {/* Stats Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-100 rounded-xl">
              <Tag className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Total</p>
              <p className="text-xl font-bold text-slate-900">{stats.total}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-100 rounded-xl">
              <Zap className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Active</p>
              <p className="text-xl font-bold text-emerald-600">{stats.active}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Scheduled</p>
              <p className="text-xl font-bold text-amber-600">{stats.scheduled}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-purple-100 rounded-xl">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Conversions</p>
              <p className="text-xl font-bold text-purple-600">{stats.totalConversions}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-green-100 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-slate-500">Revenue</p>
              <p className="text-xl font-bold text-green-600">{formatRevenueStat(stats.totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 lg:pb-0">
            {(['all', 'active', 'scheduled', 'expired'] as const).map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                  filter === status
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
          
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-2 border border-slate-200 rounded-lg bg-white text-sm"
          >
            <option value="all">All Types</option>
            {PROMOTION_TYPES.map(type => (
              <option key={type.id} value={type.id}>{type.name}</option>
            ))}
          </select>
          
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search promotions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
            />
          </div>
        </div>
      </div>

      {/* Promotions List */}
      {filteredPromotions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-16 text-center shadow-sm">
          <div className="w-20 h-20 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Gift className="w-10 h-10 text-orange-500" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">
            {promotions.length === 0 ? 'No promotions yet' : 'No matching promotions'}
          </h3>
          <p className="text-slate-500 mt-2 max-w-md mx-auto">
            {promotions.length === 0 
              ? 'Create your first promotion to attract more customers and boost sales'
              : 'Try adjusting your filters or search query'
            }
          </p>
          {promotions.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-6 px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl transition-all"
            >
              <Plus className="w-5 h-5 inline mr-2" />
              Create Your First Promotion
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPromotions.map(promo => {
            const promoType = PROMOTION_TYPES.find(t => t.id === promo.promotion_type) || PROMOTION_TYPES[0];
            const TypeIcon = promoType.icon;
            const effectiveStatus = getEffectivePromotionStatus(promo);
            const isActive = effectiveStatus === 'live';
            const isScheduled = effectiveStatus === 'scheduled';
            const isExpired = effectiveStatus === 'expired';
            
            return (
              <div 
                key={promo.id} 
                className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg transition-all group"
              >
                {/* Header with gradient based on type */}
                <div className={`p-4 bg-gradient-to-r ${promoType.color} text-white relative`}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <TypeIcon className="w-5 h-5" />
                      <span className="text-xs font-medium opacity-90">{promoType.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isActive && (
                        <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium flex items-center gap-1">
                          <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                          Live
                        </span>
                      )}
                      {isScheduled && (
                        <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">Scheduled</span>
                      )}
                      {isExpired && (
                        <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">{getEffectiveStatusLabel('expired')}</span>
                      )}
                      {effectiveStatus === 'inactive' && (
                        <span className="px-2 py-1 bg-white/20 rounded-full text-xs font-medium">{getEffectiveStatusLabel('inactive')}</span>
                      )}
                    </div>
                  </div>
                  
                  {/* Discount Display */}
                  <div className="mt-3">
                    {promo.promotion_type === 'buy_x_get_y' ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">Buy {promo.buy_quantity || 2}</span>
                        <span className="text-lg opacity-80">Get {promo.get_quantity || 1}</span>
                        <span className="text-xl font-bold">{promo.get_discount_percent || 100}% OFF</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold">
                          {promo.discount_value}{promo.discount_type === 'percentage' ? '%' : ''}
                        </span>
                        <span className="text-lg opacity-80">
                          {promo.discount_type === 'percentage' ? 'OFF' : '₹ OFF'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 text-lg">{promo.name}</h3>
                    <p className="text-sm text-slate-500 line-clamp-2 mt-1">{promo.description}</p>
                  </div>
                  
                  {/* Code */}
                  {promo.code && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <code className="font-mono font-semibold text-slate-800">{promo.code}</code>
                      </div>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(promo.code || '');
                          toast.success('Code copied!');
                        }}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4 text-slate-500" />
                      </button>
                    </div>
                  )}
                  
                  {/* Date Range */}
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(promo.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                    <ArrowRight className="w-3 h-3" />
                    <span>{new Date(promo.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                  
                  {/* Stats Row */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                    <span className="flex items-center gap-1">
                      <Eye className="w-3 h-3" /> {promo.views || 0} views
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" /> {promo.usage_count ?? promo.conversions ?? 0} uses
                    </span>
                    {promo.usage_limit && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" /> {promo.usage_count || 0}/{promo.usage_limit}
                      </span>
                    )}
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => togglePromotion(promo.id, promo.is_active)}
                      className={`flex-1 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors ${
                        promo.is_active 
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {promo.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {getToggleLabel(promo)}
                    </button>
                    <button
                      onClick={() => {
                        setEditingPromo(promo);
                        setShowAddModal(true);
                      }}
                      className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => duplicatePromotion(promo)}
                      className="p-2 border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deletePromotion(promo.id)}
                      className="p-2 border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Tips */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
        <div className="flex items-start gap-3">
          <Sparkles className="w-6 h-6 text-violet-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-violet-900 mb-2">Promotion Tips</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-violet-700">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span>Flash sales create urgency - keep them short (24-48 hours)</span>
              </div>
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4" />
                <span>BOGO offers drive volume - great for clearing stock</span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4" />
                <span>Bundles increase average order value by 25%+</span>
              </div>
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <span>Use memorable coupon codes that are easy to share</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showAddModal && (
        <PromotionModal
          promo={editingPromo}
          sellerId={sellerId}
          products={products}
          categories={categories}
          onClose={() => {
            setShowAddModal(false);
            setEditingPromo(null);
          }}
          onSave={() => {
            setShowAddModal(false);
            setEditingPromo(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}

// Enhanced Promotion Modal with all features
function PromotionModal({ 
  promo, 
  sellerId, 
  products, 
  categories,
  onClose, 
  onSave 
}: {
  promo: Promotion | null;
  sellerId: string;
  products: Product[];
  categories: string[];
  onClose: () => void;
  onSave: () => void;
}) {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: promo?.name || '',
    description: promo?.description || '',
    code: promo?.code || '',
    promotion_type: promo?.promotion_type || 'flash_sale',
    discount_type: promo?.discount_type || 'percentage',
    discount_value: promo?.discount_value || 10,
    min_order_value: promo?.min_order_value || 0,
    max_discount_amount: promo?.max_discount_amount || 0,
    start_date: promo?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    end_date: promo?.end_date?.split('T')[0] || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_active: promo?.is_active ?? true,
    usage_limit: promo?.usage_limit || 0,
    target_audience: promo?.target_audience || 'all',
    applicable_products: parseJsonbArray(promo?.applicable_products),
    applicable_categories: parseJsonbArray(promo?.applicable_categories),
    // BOGO
    buy_quantity: promo?.buy_quantity || 2,
    get_quantity: promo?.get_quantity || 1,
    get_discount_percent: promo?.get_discount_percent || 100,
    // Bundle
    bundle_products: parseJsonbArray(promo?.bundle_products),
    bundle_discount: promo?.bundle_discount || 15,
  });

  const selectedType = PROMOTION_TYPES.find(t => t.id === formData.promotion_type) || PROMOTION_TYPES[0];

  const handleSubmit = async () => {
    if (!formData.name || !formData.start_date || !formData.end_date) {
      toast.error('Please fill all required fields');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...formData,
        vendor_id: sellerId,
        usage_limit: formData.usage_limit > 0 ? formData.usage_limit : null,
        min_order_value: formData.min_order_value > 0 ? formData.min_order_value : null,
        max_discount_amount: formData.max_discount_amount > 0 ? formData.max_discount_amount : null,
        discount_value:
          formData.promotion_type === 'bundle'
            ? formData.bundle_discount || formData.discount_value
            : formData.discount_value,
      };

      if (promo?.id) {
        await apiClient.put(`/vendor/${sellerId}/promotions/${promo.id}`, payload);
        toast.success('Promotion updated successfully');
      } else {
        await apiClient.post(`/vendor/${sellerId}/promotions`, payload);
        toast.success('Promotion created successfully');
      }
      onSave();
    } catch (error) {
      console.error('Error saving promotion:', error);
      toast.error('Failed to save promotion');
    } finally {
      setSaving(false);
    }
  };

  const generateCode = () => {
    const prefix = formData.name.substring(0, 4).toUpperCase().replace(/\s/g, '');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    setFormData({ ...formData, code: `${prefix}${random}` });
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-100 p-6 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {promo ? 'Edit Promotion' : 'Create Promotion'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">Step {step} of 3</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <XCircle className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Progress Steps */}
        <div className="px-6 py-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex items-center gap-2 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step >= s ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                </div>
                <span className={`text-sm hidden sm:block ${step >= s ? 'text-slate-900' : 'text-slate-400'}`}>
                  {s === 1 ? 'Type' : s === 2 ? 'Details' : 'Review'}
                </span>
                {s < 3 && <div className={`flex-1 h-0.5 ${step > s ? 'bg-orange-500' : 'bg-slate-200'}`} />}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Choose Type */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900">Choose Promotion Type</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PROMOTION_TYPES.map(type => {
                  const Icon = type.icon;
                  const isSelected = formData.promotion_type === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setFormData({ ...formData, promotion_type: type.id })}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        isSelected 
                          ? 'border-orange-500 bg-orange-50' 
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-r ${type.color} text-white`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-900">{type.name}</h4>
                          <p className="text-xs text-slate-500 mt-0.5">{type.description}</p>
                          <p className="text-xs text-slate-400 mt-1 italic">{type.example}</p>
                        </div>
                        {isSelected && (
                          <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 2: Promotion Details */}
          {step === 2 && (
            <div className="space-y-5">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Info className="w-4 h-4" />
                  Basic Information
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Promotion Name *
                    </label>
                    <input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="e.g., Weekend Flash Sale"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Description
                    </label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe your promotion..."
                      rows={2}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Coupon Code (Optional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        value={formData.code}
                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                        placeholder="e.g., FLASH20"
                        className="flex-1 px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono uppercase"
                      />
                      <button
                        type="button"
                        onClick={generateCode}
                        className="px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-600 transition-colors"
                      >
                        Generate
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Target Audience
                    </label>
                    <select
                      value={formData.target_audience}
                      onChange={(e) => setFormData({ ...formData, target_audience: e.target.value as any })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                    >
                      <option value="all">All Customers</option>
                      <option value="new_users">New Customers Only</option>
                      <option value="returning_users">Returning Customers</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Discount Configuration based on type */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Percent className="w-4 h-4" />
                  {selectedType.name} Configuration
                </div>

                {/* Standard Discount (for most types) */}
                {['flash_sale', 'seasonal', 'first_order', 'category_discount'].includes(formData.promotion_type) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Discount Type
                      </label>
                      <select
                        value={formData.discount_type}
                        onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 bg-white"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed Amount (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Discount Value *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max={formData.discount_type === 'percentage' ? 100 : undefined}
                          value={formData.discount_value}
                          onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                          {formData.discount_type === 'percentage' ? '%' : '₹'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Buy X Get Y Configuration */}
                {formData.promotion_type === 'buy_x_get_y' && (
                  <div className="bg-purple-50 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Buy Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.buy_quantity}
                          onChange={(e) => setFormData({ ...formData, buy_quantity: parseInt(e.target.value) || 2 })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Get Quantity
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={formData.get_quantity}
                          onChange={(e) => setFormData({ ...formData, get_quantity: parseInt(e.target.value) || 1 })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          At % Off
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.get_discount_percent}
                          onChange={(e) => setFormData({ ...formData, get_discount_percent: parseInt(e.target.value) || 100 })}
                          className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 bg-white"
                        />
                      </div>
                    </div>
                    <div className="text-sm text-purple-700 font-medium">
                      Preview: Buy {formData.buy_quantity}, Get {formData.get_quantity} at {formData.get_discount_percent}% off
                      {formData.get_discount_percent === 100 && ' (FREE)'}
                    </div>
                  </div>
                )}

                {/* Bundle Configuration */}
                {formData.promotion_type === 'bundle' && (
                  <div className="bg-teal-50 rounded-xl p-4 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Bundle Discount (%)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formData.bundle_discount}
                        onChange={(e) => setFormData({ ...formData, bundle_discount: parseInt(e.target.value) || 15 })}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 bg-white"
                      />
                    </div>
                    <div className="text-sm text-teal-700">
                      Customers get {formData.bundle_discount}% off when buying selected products together
                    </div>
                    {products.length > 0 && (
                      <PromotionProductPicker
                        products={products}
                        selectedIds={formData.bundle_products}
                        onChange={(ids) => setFormData({ ...formData, bundle_products: ids })}
                        mode="bundle_required"
                        label="Select Bundle Products"
                        hint="Customer must have all selected products in cart."
                      />
                    )}
                  </div>
                )}

                {usesApplicableProducts(formData.promotion_type) && products.length > 0 && (
                  <div className="rounded-xl border border-slate-100 p-4 bg-slate-50/50">
                    <PromotionProductPicker
                      products={products}
                      selectedIds={formData.applicable_products}
                      onChange={(ids) => setFormData({ ...formData, applicable_products: ids })}
                      mode="all_or_selected"
                      label="Product scope (optional)"
                      hint="Leave as all products or pick specific SKUs for this offer."
                    />
                  </div>
                )}

                {/* Category Selection */}
                {formData.promotion_type === 'category_discount' && categories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Apply to Categories
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            if (formData.applicable_categories.includes(cat)) {
                              setFormData({ ...formData, applicable_categories: formData.applicable_categories.filter(c => c !== cat) });
                            } else {
                              setFormData({ ...formData, applicable_categories: [...formData.applicable_categories, cat] });
                            }
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            formData.applicable_categories.includes(cat)
                              ? 'bg-orange-500 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Limits & Validity */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Calendar className="w-4 h-4" />
                  Validity & Limits
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      End Date *
                    </label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Min Order Value (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_order_value}
                      onChange={(e) => setFormData({ ...formData, min_order_value: parseFloat(e.target.value) || 0 })}
                      placeholder="0 for no minimum"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Max Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.max_discount_amount}
                      onChange={(e) => setFormData({ ...formData, max_discount_amount: parseFloat(e.target.value) || 0 })}
                      placeholder="0 for no cap"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Usage Limit
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usage_limit}
                      onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || 0 })}
                      placeholder="0 for unlimited"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                    />
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.is_active}
                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                        className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500"
                      />
                      <span className="font-medium text-slate-700">Active immediately</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === 3 && (
            <div className="space-y-5">
              <h3 className="font-semibold text-slate-900">Review Your Promotion</h3>
              
              {/* Preview Card */}
              <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden">
                <div className={`p-4 bg-gradient-to-r ${selectedType.color} text-white`}>
                  <div className="flex items-center gap-2 mb-2">
                    {(() => { const Icon = selectedType.icon; return <Icon className="w-5 h-5" />; })()}
                    <span className="text-sm font-medium opacity-90">{selectedType.name}</span>
                  </div>
                  {formData.promotion_type === 'buy_x_get_y' ? (
                    <div className="text-2xl font-bold">
                      Buy {formData.buy_quantity} Get {formData.get_quantity} at {formData.get_discount_percent}% OFF
                    </div>
                  ) : (
                    <div className="text-2xl font-bold">
                      {formData.discount_value}{formData.discount_type === 'percentage' ? '%' : '₹'} OFF
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  <h4 className="font-semibold text-lg text-slate-900">{formData.name || 'Untitled Promotion'}</h4>
                  <p className="text-sm text-slate-500">{formData.description || 'No description'}</p>
                  
                  {formData.code && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg w-fit">
                      <Tag className="w-4 h-4 text-slate-400" />
                      <code className="font-mono font-semibold">{formData.code}</code>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3 pt-2 text-sm">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span>{new Date(formData.start_date).toLocaleDateString()} - {new Date(formData.end_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-600">
                      <Users className="w-4 h-4 text-slate-400" />
                      <span>{formData.target_audience === 'all' ? 'All customers' : formData.target_audience === 'new_users' ? 'New customers' : 'Returning customers'}</span>
                    </div>
                    {formData.min_order_value > 0 && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <ShoppingBag className="w-4 h-4 text-slate-400" />
                        <span>Min ₹{formData.min_order_value}</span>
                      </div>
                    )}
                    {formData.usage_limit > 0 && (
                      <div className="flex items-center gap-2 text-slate-600">
                        <Target className="w-4 h-4 text-slate-400" />
                        <span>Limit: {formData.usage_limit} uses</span>
                      </div>
                    )}
                    {(usesApplicableProducts(formData.promotion_type) ||
                      usesBundleProducts(formData.promotion_type)) && (
                      <div className="sm:col-span-2 flex items-center gap-2 text-slate-600">
                        <Package className="w-4 h-4 text-slate-400" />
                        <span>
                          {usesBundleProducts(formData.promotion_type)
                            ? productScopeLabel(formData.bundle_products, products.length)
                            : productScopeLabel(formData.applicable_products, products.length)}
                          {(() => {
                            const ids = usesBundleProducts(formData.promotion_type)
                              ? formData.bundle_products
                              : formData.applicable_products;
                            if (ids.length === 0) return '';
                            const names = ids
                              .map((id) => products.find((p) => p.id === id)?.name)
                              .filter(Boolean)
                              .slice(0, 3);
                            return names.length ? ` — ${names.join(', ')}${ids.length > 3 ? '…' : ''}` : '';
                          })()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className={`p-4 rounded-xl flex items-center gap-3 ${formData.is_active ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
                <AlertCircle className={`w-5 h-5 ${formData.is_active ? 'text-emerald-600' : 'text-amber-600'}`} />
                <div>
                  <p className={`font-medium ${formData.is_active ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {formData.is_active ? 'This promotion will be active immediately' : 'This promotion is set to inactive'}
                  </p>
                  <p className={`text-sm ${formData.is_active ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {formData.is_active 
                      ? 'Customers will see this promotion right away if within the date range'
                      : 'You can activate it later from the promotions list'
                    }
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-6 flex items-center justify-between flex-shrink-0">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-6 py-3 border border-slate-200 text-slate-700 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 2 && !formData.name}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl disabled:opacity-50 transition-all"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold shadow-lg shadow-orange-500/25 hover:shadow-xl disabled:opacity-50 transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {promo ? 'Update Promotion' : 'Create Promotion'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
