import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import {
  Plus, Edit2, Trash2, Save, X, DollarSign, Users, Heart,
  TrendingUp, Shield, Star, Percent, Calendar, Check, AlertCircle
} from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner';

interface SubscriptionTier {
  id: string;
  name: string;
  description: string;
  tierType: 'vendor' | 'customer' | 'p2p_service';
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'semi_annual' | 'annual';
  commissionRate: number | null;
  applicableRoles: string[];
  benefits: Record<string, any>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const VENDOR_ROLES = [
  'all', 'veterinarian', 'walker', 'groomer', 'trainer', 'boarding',
  'cafes', 'photography', 'breeder', 'ambulance', 'nutritionist',
  'relocation', 'insurance', 'resort', 'adoption', 'sunset'
];

const BILLING_CYCLES = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly (3 months)' },
  { value: 'semi_annual', label: 'Semi-Annual (6 months)' },
  { value: 'annual', label: 'Annual (12 months)' }
];

export function PlatformSubscriptionTiers() {
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTier, setEditingTier] = useState<SubscriptionTier | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tierType: 'vendor' as 'vendor' | 'customer' | 'p2p_service',
    price: 0,
    billingCycle: 'monthly' as 'monthly' | 'quarterly' | 'semi_annual' | 'annual',
    commissionRate: 0,
    applicableRoles: ['all'],
    benefits: {},
    isActive: true
  });

  useEffect(() => {
    loadTiers();
    loadAnalytics();
  }, []);

  const loadTiers = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/subscription-tiers`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setTiers(result.tiers || []);
      }
    } catch (error) {
      console.error('Error loading tiers:', error);
      toast.error('Failed to load subscription tiers');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/subscription-tiers/analytics`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );

      if (response.ok) {
        const result = await response.json();
        setAnalytics(result.analytics);
      }
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  const handleCreateOrUpdate = async () => {
    try {
      const url = editingTier
        ? `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/subscription-tiers/${editingTier.id}`
        : `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/subscription-tiers`;

      const method = editingTier ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        toast.success(editingTier ? 'Tier updated successfully' : 'Tier created successfully');
        setShowModal(false);
        resetForm();
        loadTiers();
        loadAnalytics();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save tier');
      }
    } catch (error) {
      console.error('Error saving tier:', error);
      toast.error('Failed to save tier');
    }
  };

  const handleEdit = (tier: SubscriptionTier) => {
    setEditingTier(tier);
    setFormData({
      name: tier.name,
      description: tier.description,
      tierType: tier.tierType,
      price: tier.price,
      billingCycle: tier.billingCycle,
      commissionRate: tier.commissionRate || 0,
      applicableRoles: tier.applicableRoles,
      benefits: tier.benefits,
      isActive: tier.isActive
    });
    setShowModal(true);
  };

  const handleDelete = async (tierId: string) => {
    if (!confirm('Are you sure you want to delete this tier? This action cannot be undone if there are active subscribers.')) {
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475/admin/subscription-tiers/${tierId}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        }
      );

      if (response.ok) {
        toast.success('Tier deleted successfully');
        loadTiers();
        loadAnalytics();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to delete tier');
      }
    } catch (error) {
      console.error('Error deleting tier:', error);
      toast.error('Failed to delete tier');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      tierType: 'vendor',
      price: 0,
      billingCycle: 'monthly',
      commissionRate: 0,
      applicableRoles: ['all'],
      benefits: {},
      isActive: true
    });
    setEditingTier(null);
  };

  const getTierTypeIcon = (type: string) => {
    switch (type) {
      case 'vendor': return Shield;
      case 'customer': return Users;
      case 'p2p_service': return Heart;
      default: return Star;
    }
  };

  const getTierTypeColor = (type: string) => {
    switch (type) {
      case 'vendor': return 'from-blue-500 to-blue-600';
      case 'customer': return 'from-purple-500 to-purple-600';
      case 'p2p_service': return 'from-pink-500 to-pink-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getBillingLabel = (cycle: string) => {
    const found = BILLING_CYCLES.find(c => c.value === cycle);
    return found ? found.label : cycle;
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subscription Tier Management</h1>
            <p className="text-gray-600 mt-1">Create and manage subscription tiers for vendors, customers, and P2P services</p>
          </div>
          <Button
            onClick={() => setShowModal(true)}
            className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Tier
          </Button>
        </div>
      </div>

      {/* Analytics Summary */}
      {analytics && (
        <div className="max-w-7xl mx-auto mb-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Tiers</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalTiers}</p>
              </div>
              <Star className="w-8 h-8 text-yellow-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Subscribers</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalSubscribers}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">₹{analytics.totalRevenue.toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">P2P Services</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.tiersByType.p2p_service}</p>
              </div>
              <Heart className="w-8 h-8 text-pink-500" />
            </div>
          </div>
        </div>
      )}

      {/* Tiers List */}
      <div className="max-w-7xl mx-auto">
        {loading ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading subscription tiers...</p>
          </div>
        ) : tiers.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center border border-gray-200">
            <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600">No subscription tiers created yet</p>
            <Button
              onClick={() => setShowModal(true)}
              className="mt-4 bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white"
            >
              Create Your First Tier
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tiers.map((tier) => {
              const TierIcon = getTierTypeIcon(tier.tierType);
              const tierColor = getTierTypeColor(tier.tierType);

              return (
                <div
                  key={tier.id}
                  className={`bg-white rounded-lg border-2 ${
                    tier.isActive ? 'border-gray-200' : 'border-red-200 opacity-60'
                  } overflow-hidden hover:shadow-lg transition-shadow`}
                >
                  {/* Tier Header */}
                  <div className={`bg-gradient-to-r ${tierColor} p-4 text-white`}>
                    <div className="flex items-start justify-between mb-2">
                      <TierIcon className="w-8 h-8" />
                      {!tier.isActive && (
                        <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">Inactive</span>
                      )}
                    </div>
                    <h3 className="font-bold text-xl">{tier.name}</h3>
                    <p className="text-sm opacity-90 mt-1">{tier.description || 'No description'}</p>
                  </div>

                  {/* Tier Body */}
                  <div className="p-4">
                    {/* Pricing */}
                    <div className="mb-4">
                      <div className="flex items-baseline gap-1">
                        <span className="text-3xl font-bold text-gray-900">₹{tier.price}</span>
                        <span className="text-gray-600">/{tier.billingCycle}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{getBillingLabel(tier.billingCycle)}</p>
                    </div>

                    {/* Type Badge */}
                    <div className="mb-3">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold bg-gradient-to-r ${tierColor} text-white`}>
                        {tier.tierType === 'p2p_service' ? 'P2P Service' : tier.tierType.charAt(0).toUpperCase() + tier.tierType.slice(1)} Tier
                      </span>
                    </div>

                    {/* Commission Rate (for vendor tiers) */}
                    {tier.tierType === 'vendor' && tier.commissionRate !== null && (
                      <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 rounded">
                        <Percent className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-green-800">
                          <strong>{tier.commissionRate}%</strong> Commission Rate
                        </span>
                      </div>
                    )}

                    {/* Applicable Roles */}
                    {tier.tierType === 'vendor' && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 mb-1">Applicable to:</p>
                        <div className="flex flex-wrap gap-1">
                          {tier.applicableRoles.slice(0, 3).map((role, idx) => (
                            <span key={idx} className="text-xs px-2 py-1 bg-gray-100 rounded">
                              {role}
                            </span>
                          ))}
                          {tier.applicableRoles.length > 3 && (
                            <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                              +{tier.applicableRoles.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Benefits */}
                    {Object.keys(tier.benefits).length > 0 && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 mb-2">Benefits:</p>
                        <div className="space-y-1">
                          {Object.entries(tier.benefits).slice(0, 3).map(([key, value], idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <Check className="w-4 h-4 text-green-500" />
                              <span className="text-gray-700">{key.replace(/_/g, ' ')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-3 border-t border-gray-200">
                      <Button
                        onClick={() => handleEdit(tier)}
                        variant="outline"
                        size="sm"
                        className="flex-1"
                      >
                        <Edit2 className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <Button
                        onClick={() => handleDelete(tier.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingTier ? 'Edit Subscription Tier' : 'Create Subscription Tier'}
              </h2>
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Tier Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tier Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Gold Member, Premium Vendor, Dating Plus"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this tier offers..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                />
              </div>

              {/* Tier Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tier Type *
                </label>
                <select
                  value={formData.tierType}
                  onChange={(e) => setFormData({ ...formData, tierType: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                >
                  <option value="vendor">Vendor Tier (Commission Control)</option>
                  <option value="customer">Customer Tier (Benefits & Perks)</option>
                  <option value="p2p_service">P2P Service Tier (Dating, etc.)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  {formData.tierType === 'vendor' && 'Controls commission rates for vendor bookings'}
                  {formData.tierType === 'customer' && 'Provides benefits like free delivery, priority support'}
                  {formData.tierType === 'p2p_service' && 'Unlocks P2P features like Mating & Dating'}
                </p>
              </div>

              {/* Price & Billing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Billing Cycle *
                  </label>
                  <select
                    value={formData.billingCycle}
                    onChange={(e) => setFormData({ ...formData, billingCycle: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  >
                    {BILLING_CYCLES.map(cycle => (
                      <option key={cycle.value} value={cycle.value}>{cycle.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Commission Rate (Vendor Only) */}
              {formData.tierType === 'vendor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Commission Rate (%) *
                  </label>
                  <input
                    type="number"
                    value={formData.commissionRate}
                    onChange={(e) => setFormData({ ...formData, commissionRate: Number(e.target.value) })}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Platform commission on vendor bookings (0-100%)</p>
                </div>
              )}

              {/* Applicable Roles (Vendor Only) */}
              {formData.tierType === 'vendor' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Applicable Vendor Roles *
                  </label>
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-200 rounded-lg">
                    {VENDOR_ROLES.map(role => (
                      <label key={role} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={formData.applicableRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setFormData({
                                ...formData,
                                applicableRoles: role === 'all' 
                                  ? ['all'] 
                                  : [...formData.applicableRoles.filter(r => r !== 'all'), role]
                              });
                            } else {
                              setFormData({
                                ...formData,
                                applicableRoles: formData.applicableRoles.filter(r => r !== role)
                              });
                            }
                          }}
                          className="rounded"
                        />
                        <span>{role}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefits */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Benefits (JSON Format)
                </label>
                <textarea
                  value={JSON.stringify(formData.benefits, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      setFormData({ ...formData, benefits: parsed });
                    } catch (err) {
                      // Invalid JSON, keep current value
                    }
                  }}
                  placeholder={'{\n  "dating_chat": true,\n  "free_delivery": true,\n  "priority_support": true\n}'}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#FF8C42] focus:border-transparent font-mono text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">Define feature flags and benefits in JSON format</p>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Active (Users can subscribe)
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex items-center justify-end gap-3 border-t border-gray-200">
              <Button
                onClick={() => { setShowModal(false); resetForm(); }}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateOrUpdate}
                className="bg-gradient-to-r from-[#FF8C42] to-[#FF6B35] text-white"
                disabled={!formData.name || formData.price < 0}
              >
                <Save className="w-4 h-4 mr-2" />
                {editingTier ? 'Update Tier' : 'Create Tier'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
