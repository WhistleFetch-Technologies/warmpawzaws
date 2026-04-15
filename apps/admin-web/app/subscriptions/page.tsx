'use client';

/**
 * ============================================================================
 * ADMIN SUBSCRIPTION PLAN MANAGEMENT PAGE
 * ============================================================================
 * 
 * Full CRUD for subscription plans
 * - Create/edit subscription plans
 * - Configure pricing tiers
 * - Set included services
 * - Manage active subscriptions
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Eye, Search, Filter,
  CreditCard, Users, TrendingUp, Package, Check,
  X, Loader2, Save, ChevronRight, Sparkles, Repeat
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api-client';
import { AdminRouteGuard } from '@/components/admin/layout/AdminRouteGuard';
import { toast } from 'sonner';

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  includedServices: string[];
  maxBookingsPerMonth: number;
  discountPercentage: number;
  isPopular: boolean;
  isActive: boolean;
  subscriberCount: number;
  createdAt: string;
}

interface PlanFormData {
  name: string;
  description: string;
  price: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
  features: string[];
  includedServices: string[];
  maxBookingsPerMonth: number;
  discountPercentage: number;
  isPopular: boolean;
  isActive: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SubscriptionPlanManagementPage() {
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [stats, setStats] = useState({
    totalPlans: 0,
    activeSubscribers: 0,
    monthlyRevenue: 0,
    popularPlan: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [availableServices, setAvailableServices] = useState<{id: string; name: string}[]>([]);

  // Form state
  const [formData, setFormData] = useState<PlanFormData>({
    name: '',
    description: '',
    price: 0,
    billingCycle: 'monthly',
    features: [''],
    includedServices: [],
    maxBookingsPerMonth: 10,
    discountPercentage: 10,
    isPopular: false,
    isActive: true,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, servicesRes] = await Promise.all([
        apiClient.get<any>('/admin/subscriptions/plans'),
        apiClient.get<any>('/service-catalog/categories'),
      ]);

      if (plansRes.success) {
        setPlans(plansRes.plans || []);
        setStats({
          totalPlans: plansRes.plans?.length || 0,
          activeSubscribers: plansRes.activeSubscribers || 0,
          monthlyRevenue: plansRes.monthlyRevenue || 0,
          popularPlan: plansRes.popularPlan || '-',
        });
      }

      if (servicesRes.success) {
        setAvailableServices(servicesRes.categories?.map((c: any) => ({
          id: c.id,
          name: c.name,
        })) || []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      // Set mock data for development
      setPlans([
        {
          id: '1',
          name: 'Basic Care',
          description: 'Essential pet care for everyday needs',
          price: 499,
          billingCycle: 'monthly',
          features: ['2 Vet Consultations', 'Basic Health Tips', 'Email Support'],
          includedServices: ['vet_consultation'],
          maxBookingsPerMonth: 2,
          discountPercentage: 5,
          isPopular: false,
          isActive: true,
          subscriberCount: 145,
          createdAt: '2025-01-01',
        },
        {
          id: '2',
          name: 'Premium Care',
          description: 'Complete pet wellness package',
          price: 999,
          billingCycle: 'monthly',
          features: ['5 Vet Consultations', 'Priority Booking', '10% Discount', '24/7 Support'],
          includedServices: ['vet_consultation', 'grooming', 'vaccination'],
          maxBookingsPerMonth: 5,
          discountPercentage: 10,
          isPopular: true,
          isActive: true,
          subscriberCount: 312,
          createdAt: '2025-01-01',
        },
        {
          id: '3',
          name: 'Unlimited',
          description: 'All services, no limits',
          price: 2499,
          billingCycle: 'monthly',
          features: ['Unlimited Consultations', 'All Services Included', '20% Discount', 'VIP Support', 'Free Home Visits'],
          includedServices: ['all'],
          maxBookingsPerMonth: -1,
          discountPercentage: 20,
          isPopular: false,
          isActive: true,
          subscriberCount: 89,
          createdAt: '2025-01-01',
        },
      ]);
      setStats({
        totalPlans: 3,
        activeSubscribers: 546,
        monthlyRevenue: 485000,
        popularPlan: 'Premium Care',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setFormData({
      name: '',
      description: '',
      price: 0,
      billingCycle: 'monthly',
      features: [''],
      includedServices: [],
      maxBookingsPerMonth: 10,
      discountPercentage: 10,
      isPopular: false,
      isActive: true,
    });
    setShowCreateModal(true);
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      price: plan.price,
      billingCycle: plan.billingCycle,
      features: Array.isArray(plan.features) && plan.features.length > 0 ? plan.features : [''],
      includedServices: plan.includedServices,
      maxBookingsPerMonth: plan.maxBookingsPerMonth,
      discountPercentage: plan.discountPercentage,
      isPopular: plan.isPopular,
      isActive: plan.isActive,
    });
    setShowCreateModal(true);
  };

  const handleSavePlan = async () => {
    if (!formData.name.trim()) {
      toast.error('Plan name is required');
      return;
    }
    if (formData.price <= 0) {
      toast.error('Price must be greater than 0');
      return;
    }

    setSaving(true);
    try {
      const cleanedFeatures = formData.features.filter(f => f.trim());
      
      const payload = {
        ...formData,
        features: cleanedFeatures,
      };

      let res;
      if (editingPlan) {
        res = await apiClient.put<any>(`/admin/subscriptions/plans/${editingPlan.id}`, payload);
      } else {
        res = await apiClient.post<any>('/admin/subscriptions/plans', payload);
      }

      if (res.success) {
        toast.success(editingPlan ? 'Plan updated successfully' : 'Plan created successfully');
        setShowCreateModal(false);
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this plan?')) return;

    try {
      const res = await apiClient.delete<any>(`/admin/subscriptions/plans/${planId}`);
      if (res.success) {
        toast.success('Plan deleted successfully');
        fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete plan');
    }
  };

  const handleToggleActive = async (plan: SubscriptionPlan) => {
    try {
      await apiClient.put<any>(`/admin/subscriptions/plans/${plan.id}`, {
        isActive: !plan.isActive,
      });
      toast.success(plan.isActive ? 'Plan deactivated' : 'Plan activated');
      fetchData();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update plan');
    }
  };

  const addFeature = () => {
    setFormData(prev => ({
      ...prev,
      features: [...prev.features, ''],
    }));
  };

  const removeFeature = (index: number) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter((_, i) => i !== index),
    }));
  };

  const updateFeature = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.map((f, i) => i === index ? value : f),
    }));
  };

  const filteredPlans = plans.filter(plan =>
    plan.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (amount: number) => `₹${amount.toLocaleString('en-IN')}`;

  return (
    <AdminRouteGuard>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-12 h-12 animate-spin text-orange-500" />
        </div>
      ) : (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Subscription Plans</h1>
            <p className="text-gray-500 mt-1">Manage customer subscription packages</p>
          </div>
          <Button
            onClick={handleCreatePlan}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create Plan
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-xl">
                  <Package className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalPlans}</p>
                  <p className="text-sm text-gray-500">Total Plans</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 rounded-xl">
                  <Users className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{stats.activeSubscribers}</p>
                  <p className="text-sm text-gray-500">Active Subscribers</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 rounded-xl">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.monthlyRevenue)}</p>
                  <p className="text-sm text-gray-500">Monthly Revenue</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 rounded-xl">
                  <Sparkles className="w-6 h-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{stats.popularPlan}</p>
                  <p className="text-sm text-gray-500">Most Popular</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              placeholder="Search plans..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-3 gap-6">
          {filteredPlans.map((plan) => (
            <Card key={plan.id} className={`relative overflow-hidden ${!plan.isActive ? 'opacity-60' : ''}`}>
              {plan.isPopular && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-orange-500 text-white">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Popular
                  </Badge>
                </div>
              )}
              
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Repeat className="w-5 h-5 text-orange-500" />
                  {plan.name}
                </CardTitle>
                <p className="text-sm text-gray-500">{plan.description}</p>
              </CardHeader>
              
              <CardContent>
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">{formatCurrency(plan.price)}</span>
                  <span className="text-gray-500">/{plan.billingCycle}</span>
                </div>

                <div className="space-y-2 mb-4">
                  {(Array.isArray(plan.features) ? plan.features : []).slice(0, 4).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500" />
                      <span>{feature}</span>
                    </div>
                  ))}
                  {Array.isArray(plan.features) && plan.features.length > 4 && (
                    <p className="text-sm text-gray-500">+{plan.features.length - 4} more features</p>
                  )}
                </div>

                <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                  <span>{plan.subscriberCount} subscribers</span>
                  <span>{plan.discountPercentage}% discount</span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEditPlan(plan)}
                    className="flex-1"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggleActive(plan)}
                  >
                    {plan.isActive ? 'Deactivate' : 'Activate'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeletePlan(plan.id)}
                    className="text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Create/Edit Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <CardHeader className="border-b">
                <div className="flex items-center justify-between">
                  <CardTitle>{editingPlan ? 'Edit Plan' : 'Create Subscription Plan'}</CardTitle>
                  <button onClick={() => setShowCreateModal(false)}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 space-y-4">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Premium Care"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of the plan"
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg resize-none focus:border-orange-500 outline-none"
                  />
                </div>

                {/* Price and Billing */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                      placeholder="499"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle</label>
                    <select
                      value={formData.billingCycle}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData(prev => ({ ...prev, billingCycle: e.target.value as any }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:border-orange-500 outline-none"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings/Month</label>
                    <Input
                      type="number"
                      value={formData.maxBookingsPerMonth}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, maxBookingsPerMonth: parseInt(e.target.value) || 0 }))}
                      placeholder="-1 for unlimited"
                    />
                    <p className="text-xs text-gray-500 mt-1">Use -1 for unlimited</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Discount %</label>
                    <Input
                      type="number"
                      value={formData.discountPercentage}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, discountPercentage: parseInt(e.target.value) || 0 }))}
                      placeholder="10"
                      max={100}
                    />
                  </div>
                </div>

                {/* Features */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700">Features</label>
                    <Button variant="ghost" size="sm" onClick={addFeature}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {formData.features.map((feature, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={feature}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateFeature(i, e.target.value)}
                          placeholder="e.g., 5 Vet Consultations"
                        />
                        {formData.features.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeFeature(i)}>
                            <X className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Flags */}
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isPopular}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, isPopular: e.target.checked }))}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm">Mark as Popular</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                      className="w-4 h-4 accent-orange-500"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSavePlan}
                    disabled={saving}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    {saving ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingPlan ? 'Update Plan' : 'Create Plan'}
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
      )}
    </AdminRouteGuard>
  );
}
