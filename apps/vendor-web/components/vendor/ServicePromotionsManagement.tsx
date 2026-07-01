'use client';

import { useState, useEffect } from 'react';
import { 
  Tag, Plus, Edit2, Trash2, Calendar, Percent, Gift, Zap, Clock, 
  CheckCircle, XCircle, Search, Package, Users, Scissors, Stethoscope,
  Sparkles, Target, TrendingUp, Copy, Eye, ToggleLeft, ToggleRight,
  ArrowLeft, ArrowRight, Info, AlertCircle, Home, Building2, Phone
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';

// Service promotion types
const PROMOTION_TYPES = [
  { 
    id: 'flash_sale', 
    name: 'Flash Sale', 
    icon: Zap, 
    color: 'from-rose-500 to-pink-500',
    description: 'Limited-time discount to create urgency',
    example: 'e.g., 24-hour 30% off all services'
  },
  { 
    id: 'seasonal', 
    name: 'Seasonal/Weekend Sale', 
    icon: Calendar, 
    color: 'from-amber-500 to-orange-500',
    description: 'Weekend, holiday, or seasonal promotions',
    example: 'e.g., Summer Special, Weekend Offer'
  },
  { 
    id: 'first_booking', 
    name: 'First Booking', 
    icon: Users, 
    color: 'from-blue-500 to-cyan-500',
    description: 'Special discount for first-time customers',
    example: 'e.g., 20% off first grooming session'
  },
  { 
    id: 'combo', 
    name: 'Service Combo', 
    icon: Package, 
    color: 'from-teal-500 to-emerald-500',
    description: 'Discount on service combinations',
    example: 'e.g., Bath + Haircut = 15% off'
  },
  { 
    id: 'loyalty', 
    name: 'Loyalty Reward', 
    icon: Gift, 
    color: 'from-purple-500 to-indigo-500',
    description: 'Reward for returning customers',
    example: 'e.g., 5th visit free or discounted'
  },
  { 
    id: 'service_specific', 
    name: 'Service Discount', 
    icon: Tag, 
    color: 'from-slate-500 to-zinc-500',
    description: 'Discount on specific services',
    example: 'e.g., All vaccinations 20% off'
  },
];

const SERVICE_STYLES = [
  { id: 'all', name: 'All Styles', icon: Sparkles },
  { id: 'at_home', name: 'At Home', icon: Home },
  { id: 'at_center', name: 'At Center', icon: Building2 },
  { id: 'tele', name: 'Tele Consult', icon: Phone },
];

interface ServicePromotionsManagementProps {
  vendorId: string;
  vendorRole?: string;
  onBack?: () => void;
}

interface ServicePromotion {
  id: string;
  name: string;
  description: string;
  code?: string;
  promotion_type: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_booking_value?: number;
  max_discount_amount?: number;
  start_date: string;
  end_date: string;
  is_active: boolean;
  usage_limit?: number;
  usage_count?: number;
  target_audience?: 'all' | 'new_users' | 'returning_users';
  applicable_services?: string[];
  applicable_service_styles?: string[];
  // Combo specific
  combo_services?: string[];
  combo_discount?: number;
  // Loyalty specific
  visits_required?: number;
  loyalty_discount?: number;
  // Analytics
  views?: number;
  conversions?: number;
  revenue_generated?: number;
}

interface Service {
  id: string;
  name: string;
  price: number;
  service_style?: string;
  category?: string;
}

export function ServicePromotionsManagement({ vendorId, vendorRole, onBack }: ServicePromotionsManagementProps) {
  const [promotions, setPromotions] = useState<ServicePromotion[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPromo, setEditingPromo] = useState<ServicePromotion | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'scheduled' | 'expired'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Role-aware labels
  const getRoleLabel = () => {
    switch (vendorRole) {
      case 'veterinarian': return 'appointments';
      case 'groomer': return 'sessions';
      case 'trainer': return 'sessions';
      default: return 'bookings';
    }
  };

  useEffect(() => {
    loadData();
  }, [vendorId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [promosRes, servicesRes] = await Promise.all([
        apiClient.get<{ promotions?: ServicePromotion[] }>(`/vendor/${vendorId}/service-promotions`).catch(() => ({ promotions: [] })),
        apiClient.get<{ services?: Service[] }>(`/vendor/${vendorId}/services/enabled`).catch(() => ({ services: [] }))
      ]);
      
      setPromotions((promosRes as any)?.promotions || []);
      setServices((servicesRes as any)?.services || []);
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
      await apiClient.delete(`/vendor/${vendorId}/service-promotions/${id}`);
      toast.success('Promotion deleted');
      loadData();
    } catch (error) {
      toast.error('Failed to delete promotion');
    }
  };

  const togglePromotion = async (id: string, currentStatus: boolean) => {
    try {
      await apiClient.put(`/vendor/${vendorId}/service-promotions/${id}`, { is_active: !currentStatus });
      setPromotions(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentStatus } : p));
      toast.success(`Promotion ${!currentStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update promotion');
    }
  };

  // Filter promotions
  const filteredPromotions = promotions.filter(p => {
    const now = new Date();
    const startDate = new Date(p.start_date);
    const endDate = new Date(p.end_date);
    
    if (filter === 'active' && (!p.is_active || now < startDate || now > endDate)) return false;
    if (filter === 'scheduled' && now >= startDate) return false;
    if (filter === 'expired' && now <= endDate) return false;
    
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !p.code?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    
    return true;
  });

  const stats = {
    total: promotions.length,
    active: promotions.filter(p => {
      const now = new Date();
      return p.is_active && new Date(p.start_date) <= now && new Date(p.end_date) >= now;
    }).length,
    totalBookings: promotions.reduce((sum, p) => sum + (p.conversions || 0), 0),
    totalSavings: promotions.reduce((sum, p) => sum + (p.revenue_generated || 0), 0)
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl">
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div className="flex-1">
            <h1 className="text-lg font-bold">Service Promotions</h1>
            <p className="text-sm text-white/80">Active offers auto-apply for customers at booking</p>
          </div>
          <button
            onClick={() => {
              setEditingPromo(null);
              setShowAddModal(true);
            }}
            className="p-2.5 bg-white/20 hover:bg-white/30 rounded-xl transition-colors"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Active</p>
                <p className="text-xl font-bold text-slate-900">{stats.active}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total {getRoleLabel()}</p>
                <p className="text-xl font-bold text-slate-900">{stats.totalBookings}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {(['all', 'active', 'scheduled', 'expired'] as const).map(status => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                filter === status
                  ? 'bg-orange-500 text-white shadow-md'
                  : 'bg-white text-slate-600 border border-slate-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {/* Promotions List */}
        {filteredPromotions.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Gift className="w-8 h-8 text-orange-500" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">
              {promotions.length === 0 ? 'No promotions yet' : 'No matching promotions'}
            </h3>
            <p className="text-slate-500 mt-2 text-sm max-w-xs mx-auto">
              {promotions.length === 0 
                ? 'Create your first promotion to attract more customers'
                : 'Try adjusting your filters'
              }
            </p>
            {promotions.length === 0 && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-4 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/25"
              >
                Create Promotion
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPromotions.map(promo => {
              const promoType = PROMOTION_TYPES.find(t => t.id === promo.promotion_type) || PROMOTION_TYPES[0];
              const TypeIcon = promoType.icon;
              const isActive = promo.is_active && new Date(promo.start_date) <= new Date() && new Date(promo.end_date) >= new Date();
              
              return (
                <div 
                  key={promo.id} 
                  className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100"
                >
                  {/* Header Strip */}
                  <div className={`h-2 bg-gradient-to-r ${promoType.color}`} />
                  
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <TypeIcon className="w-4 h-4 text-slate-400" />
                          <span className="text-xs text-slate-500">{promoType.name}</span>
                          {isActive && (
                            <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-xs font-medium flex items-center gap-1">
                              <span className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse"></span>
                              Live
                            </span>
                          )}
                        </div>
                        <h3 className="font-semibold text-slate-900">{promo.name}</h3>
                        <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">{promo.description}</p>
                      </div>
                      
                      <div className={`px-3 py-1.5 rounded-lg bg-gradient-to-r ${promoType.color} text-white text-center min-w-[70px]`}>
                        <div className="text-lg font-bold leading-tight">
                          {promo.discount_value}{promo.discount_type === 'percentage' ? '%' : '₹'}
                        </div>
                        <div className="text-[10px] opacity-80">OFF</div>
                      </div>
                    </div>
                    
                    {/* Code & Date */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-slate-500">
                      {promo.code && (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded">
                          <Tag className="w-3 h-3" />
                          <code className="font-mono font-medium text-slate-700">{promo.code}</code>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(promo.start_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                        <span>{new Date(promo.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    
                    {/* Actions */}
                    <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => togglePromotion(promo.id, promo.is_active)}
                        className={`flex-1 py-2 rounded-lg font-medium text-sm flex items-center justify-center gap-1.5 transition-colors ${
                          promo.is_active 
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {promo.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                        {promo.is_active ? 'Active' : 'Inactive'}
                      </button>
                      <button
                        onClick={() => {
                          setEditingPromo(promo);
                          setShowAddModal(true);
                        }}
                        className="px-3 py-2 border border-slate-200 text-slate-600 rounded-lg"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deletePromotion(promo.id)}
                        className="px-3 py-2 border border-red-200 text-red-600 rounded-lg"
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
        <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-4 border border-violet-100">
          <div className="flex items-start gap-3">
            <Sparkles className="w-5 h-5 text-violet-600 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-violet-900 text-sm mb-1">Quick Tips</h3>
              <ul className="text-xs text-violet-700 space-y-1">
                <li>• Flash sales work best for 24-48 hour periods</li>
                <li>• First booking discounts attract new customers</li>
                <li>• Weekend specials can fill quieter slots</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showAddModal && (
        <ServicePromotionModal
          promo={editingPromo}
          vendorId={vendorId}
          services={services}
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

// Service Promotion Modal
function ServicePromotionModal({ 
  promo, 
  vendorId, 
  services,
  onClose, 
  onSave 
}: {
  promo: ServicePromotion | null;
  vendorId: string;
  services: Service[];
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
    discount_value: promo?.discount_value || 15,
    min_booking_value: promo?.min_booking_value || 0,
    max_discount_amount: promo?.max_discount_amount || 0,
    start_date: promo?.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
    end_date: promo?.end_date?.split('T')[0] || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    is_active: promo?.is_active ?? true,
    usage_limit: promo?.usage_limit || 0,
    target_audience: promo?.target_audience || 'all',
    applicable_services: promo?.applicable_services || [],
    applicable_service_styles: promo?.applicable_service_styles || ['all'],
    // Combo
    combo_services: promo?.combo_services || [],
    combo_discount: promo?.combo_discount || 15,
    // Loyalty
    visits_required: promo?.visits_required || 5,
    loyalty_discount: promo?.loyalty_discount || 100,
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
        vendor_id: vendorId
      };

      if (promo?.id) {
        await apiClient.put(`/vendor/${vendorId}/service-promotions/${promo.id}`, payload);
        toast.success('Promotion updated successfully');
      } else {
        await apiClient.post(`/vendor/${vendorId}/service-promotions`, payload);
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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-slate-100 p-4 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {promo ? 'Edit Promotion' : 'Create Promotion'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Step {step} of 2</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl">
            <XCircle className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Progress */}
        <div className="px-4 py-2 border-b border-slate-100 flex-shrink-0">
          <div className="flex gap-2">
            {[1, 2].map((s) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full ${step >= s ? 'bg-orange-500' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Step 1: Type & Basic */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-900 text-sm">Choose Type</h3>
              <div className="grid grid-cols-2 gap-2">
                {PROMOTION_TYPES.map(type => {
                  const Icon = type.icon;
                  const isSelected = formData.promotion_type === type.id;
                  return (
                    <button
                      key={type.id}
                      onClick={() => setFormData({ ...formData, promotion_type: type.id })}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected ? 'border-orange-500 bg-orange-50' : 'border-slate-200'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${type.color} text-white flex items-center justify-center mb-2`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <h4 className="font-medium text-slate-900 text-sm">{type.name}</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{type.description}</p>
                    </button>
                  );
                })}
              </div>

              {/* Basic Info */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Name *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Weekend Grooming Special"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="What makes this offer special?"
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 resize-none"
                  />
                </div>

                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Coupon Code</label>
                    <input
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                      placeholder="WEEKEND20"
                      className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 font-mono uppercase"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateCode}
                    className="self-end px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium"
                  >
                    Auto
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Discount & Validity */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Discount Config */}
              <div className="space-y-3">
                <h3 className="font-semibold text-slate-900 text-sm">Discount</h3>
                
                {['flash_sale', 'seasonal', 'first_booking', 'service_specific'].includes(formData.promotion_type) && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Type</label>
                      <select
                        value={formData.discount_type}
                        onChange={(e) => setFormData({ ...formData, discount_type: e.target.value as any })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm"
                      >
                        <option value="percentage">Percentage (%)</option>
                        <option value="fixed">Fixed (₹)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Value</label>
                      <input
                        type="number"
                        min="0"
                        max={formData.discount_type === 'percentage' ? 100 : undefined}
                        value={formData.discount_value}
                        onChange={(e) => setFormData({ ...formData, discount_value: parseFloat(e.target.value) || 0 })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                )}

                {/* Combo Config */}
                {formData.promotion_type === 'combo' && (
                  <div className="bg-teal-50 rounded-xl p-4 space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Combo Discount (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={formData.combo_discount}
                        onChange={(e) => setFormData({ ...formData, combo_discount: parseInt(e.target.value) || 15 })}
                        className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm"
                      />
                    </div>
                    {services.length > 0 && (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-2">Select Services for Combo</label>
                        <div className="max-h-32 overflow-y-auto space-y-1 bg-white rounded-lg p-2">
                          {services.slice(0, 10).map(service => (
                            <label key={service.id} className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer text-sm">
                              <input
                                type="checkbox"
                                checked={formData.combo_services.includes(service.id)}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setFormData({ ...formData, combo_services: [...formData.combo_services, service.id] });
                                  } else {
                                    setFormData({ ...formData, combo_services: formData.combo_services.filter(id => id !== service.id) });
                                  }
                                }}
                                className="rounded text-teal-500 focus:ring-teal-500"
                              />
                              <span className="text-slate-700">{service.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Loyalty Config */}
                {formData.promotion_type === 'loyalty' && (
                  <div className="bg-purple-50 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Visits Required</label>
                        <input
                          type="number"
                          min="2"
                          value={formData.visits_required}
                          onChange={(e) => setFormData({ ...formData, visits_required: parseInt(e.target.value) || 5 })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Discount (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={formData.loyalty_discount}
                          onChange={(e) => setFormData({ ...formData, loyalty_discount: parseInt(e.target.value) || 100 })}
                          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl bg-white text-sm"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-purple-700">
                      {formData.visits_required}th visit will be {formData.loyalty_discount}% off
                      {formData.loyalty_discount === 100 && ' (FREE)'}
                    </p>
                  </div>
                )}
              </div>

              {/* Service Styles */}
              <div className="space-y-2 pt-3 border-t border-slate-100">
                <label className="block text-sm font-medium text-slate-700">Apply to Service Style</label>
                <div className="flex flex-wrap gap-2">
                  {SERVICE_STYLES.map(style => {
                    const Icon = style.icon;
                    const isSelected = formData.applicable_service_styles.includes(style.id);
                    return (
                      <button
                        key={style.id}
                        type="button"
                        onClick={() => {
                          if (style.id === 'all') {
                            setFormData({ ...formData, applicable_service_styles: ['all'] });
                          } else {
                            const newStyles = isSelected
                              ? formData.applicable_service_styles.filter(s => s !== style.id)
                              : [...formData.applicable_service_styles.filter(s => s !== 'all'), style.id];
                            setFormData({ ...formData, applicable_service_styles: newStyles.length ? newStyles : ['all'] });
                          }
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                          isSelected
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {style.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Validity */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <h3 className="font-semibold text-slate-900 text-sm">Validity</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={formData.start_date}
                      onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">End Date</label>
                    <input
                      type="date"
                      value={formData.end_date}
                      onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Min Booking (₹)</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.min_booking_value}
                      onChange={(e) => setFormData({ ...formData, min_booking_value: parseFloat(e.target.value) || 0 })}
                      placeholder="0"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Usage Limit</label>
                    <input
                      type="number"
                      min="0"
                      value={formData.usage_limit}
                      onChange={(e) => setFormData({ ...formData, usage_limit: parseInt(e.target.value) || 0 })}
                      placeholder="Unlimited"
                      className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm"
                    />
                  </div>
                </div>
                
                <label className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-5 h-5 rounded text-orange-500 focus:ring-orange-500"
                  />
                  <span className="font-medium text-slate-700 text-sm">Activate immediately</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 p-4 flex items-center justify-between flex-shrink-0 bg-white">
          <button
            type="button"
            onClick={() => step > 1 ? setStep(step - 1) : onClose()}
            className="px-5 py-2.5 border border-slate-200 text-slate-700 rounded-xl font-medium text-sm"
          >
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          
          {step < 2 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={!formData.name}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/25 disabled:opacity-50"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-orange-500/25 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {promo ? 'Update' : 'Create'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default ServicePromotionsManagement;
