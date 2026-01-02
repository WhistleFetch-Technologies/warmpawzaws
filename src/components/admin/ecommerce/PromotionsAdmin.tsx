import { useState, useEffect } from 'react';
import { 
  Tag, Plus, Edit2, Trash2, Save, Calendar, Clock, TrendingUp,
  Target, Percent, DollarSign, Gift, Zap, Users, Package, ShoppingCart,
  Eye, EyeOff, Copy, Search, Check, ChevronDown, ChevronUp, Sparkles, Trophy,
  Loader2
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Input } from '../../ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '../../ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '../../ui/select';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';
import { toast } from 'sonner';

// Compatible with Handoff Spec
interface Promotion {
  id: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed' | 'free_shipping' | 'buy_x_get_y';
  value: number;
  minOrderAmount?: number;
  maxDiscountAmount?: number;
  validFrom: string;
  validUntil: string;
  usageLimit?: number;
  usageCount?: number;
  isActive: boolean;
  priority: number;
  code?: string;
  stats?: {
    totalRevenue: number;
    totalDiscount: number;
  };
}

export function PromotionsAdmin() {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  // Form State
  const [formData, setFormData] = useState<Partial<Promotion>>({
    name: '',
    description: '',
    type: 'percentage',
    value: 0,
    minOrderAmount: 0,
    maxDiscountAmount: 0,
    validFrom: new Date().toISOString().split('T')[0],
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    isActive: true,
    priority: 1
  });

  useEffect(() => {
    fetchPromotions();
  }, [search, statusFilter, typeFilter]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const query = new URLSearchParams({ limit: '100' });
      if (search) query.append('search', search);
      if (statusFilter !== 'all') query.append('status', statusFilter);
      if (typeFilter !== 'all') query.append('type', typeFilter);

      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/promotions?${query.toString()}`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      const data = await res.json();
      if (data.success) {
        setPromotions(data.promotions || []);
      }
    } catch (error) {
      console.error('Error loading promotions:', error);
      toast.error('Failed to load promotions');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      
      const url = editingId 
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/promotions/${editingId}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/promotions/create`;
        
      const method = editingId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      
      if (data.success) {
        toast.success(editingId ? 'Promotion updated' : 'Promotion created');
        setShowModal(false);
        fetchPromotions();
        resetForm();
      } else {
        toast.error(data.error || 'Operation failed');
      }
    } catch (error) {
      toast.error('Error saving promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this promotion?')) return;
    
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/promotions/${id}`,
        { method: 'DELETE', headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      
      if (res.ok) {
        toast.success('Promotion deleted');
        fetchPromotions();
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleStatusToggle = async (promo: Promotion) => {
    try {
      // Optimistic update
      const newStatus = !promo.isActive;
      setPromotions(promotions.map(p => p.id === promo.id ? { ...p, isActive: newStatus } : p));
      
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/promotions/${promo.id}`,
        {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: newStatus })
        }
      );
      toast.success(`Promotion ${newStatus ? 'activated' : 'deactivated'}`);
    } catch (error) {
      fetchPromotions(); // Revert
      toast.error('Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: 'percentage',
      value: 0,
      minOrderAmount: 0,
      maxDiscountAmount: 0,
      validFrom: new Date().toISOString().split('T')[0],
      validUntil: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      isActive: true,
      priority: 1
    });
    setEditingId(null);
  };

  const openEdit = (promo: Promotion) => {
    setFormData({
      name: promo.name,
      description: promo.description,
      type: promo.type,
      value: promo.value,
      minOrderAmount: promo.minOrderAmount || 0,
      maxDiscountAmount: promo.maxDiscountAmount || 0,
      validFrom: promo.validFrom ? promo.validFrom.split('T')[0] : '',
      validUntil: promo.validUntil ? promo.validUntil.split('T')[0] : '',
      isActive: promo.isActive,
      priority: promo.priority || 1
    });
    setEditingId(promo.id);
    setShowModal(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'percentage': return Percent;
      case 'fixed': return DollarSign;
      case 'free_shipping': return ShoppingCart;
      default: return Tag;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Promotions Engine</h2>
          <p className="text-gray-500">Manage sales, banners, and offers</p>
        </div>
        <Button onClick={() => { resetForm(); setShowModal(true); }} className="bg-[#FF8C42] gap-2">
          <Plus className="w-4 h-4" /> Create Promotion
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            className="pl-9" 
            placeholder="Search promotions..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="percentage">Percentage</SelectItem>
            <SelectItem value="fixed">Fixed Amount</SelectItem>
            <SelectItem value="free_shipping">Free Shipping</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF8C42]" />
          </div>
        ) : promotions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Tag className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No promotions found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {promotions.map((promo) => {
              const Icon = getTypeIcon(promo.type);
              const isExpired = promo.validUntil && new Date(promo.validUntil) < new Date();
              
              return (
                <div key={promo.id} className="p-4 hover:bg-gray-50 flex items-center gap-4">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#FF8C42]" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900 truncate">{promo.name}</h4>
                      <Badge variant="secondary" className={
                        promo.isActive && !isExpired ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }>
                        {isExpired ? 'Expired' : (promo.isActive ? 'Active' : 'Inactive')}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {promo.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="text-sm text-gray-500 mt-1 truncate">{promo.description}</div>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(promo.validFrom).toLocaleDateString()} - {new Date(promo.validUntil).toLocaleDateString()}
                      </span>
                      {promo.usageCount !== undefined && (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {promo.usageCount} uses
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => handleStatusToggle(promo)}
                      title={promo.isActive ? "Deactivate" : "Activate"}
                    >
                      {promo.isActive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => openEdit(promo)}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => handleDelete(promo.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Promotion' : 'Create Promotion'}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input 
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g. Summer Sale"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input 
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
                placeholder="Marketing text..."
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Type</label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v: any) => setFormData({...formData, type: v})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage</SelectItem>
                    <SelectItem value="fixed">Fixed Amount</SelectItem>
                    <SelectItem value="free_shipping">Free Shipping</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Value</label>
                <Input 
                  type="number"
                  value={formData.value}
                  onChange={e => setFormData({...formData, value: parseFloat(e.target.value)})}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Valid From</label>
                <Input 
                  type="date"
                  value={formData.validFrom}
                  onChange={e => setFormData({...formData, validFrom: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valid Until</label>
                <Input 
                  type="date"
                  value={formData.validUntil}
                  onChange={e => setFormData({...formData, validUntil: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Min Order Amount</label>
                <Input 
                  type="number"
                  value={formData.minOrderAmount}
                  onChange={e => setFormData({...formData, minOrderAmount: parseFloat(e.target.value)})}
                />
              </div>
              <div className="space-y-2">
                 <label className="text-sm font-medium">Max Discount</label>
                <Input 
                  type="number"
                  value={formData.maxDiscountAmount}
                  onChange={e => setFormData({...formData, maxDiscountAmount: parseFloat(e.target.value)})}
                />
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Promotion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
