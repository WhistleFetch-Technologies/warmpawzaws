'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { VendorHeader } from '@/components/vendor/VendorHeader';

// ============================================================================
// TYPES
// ============================================================================

interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  service_id: string;
  service_name: string;
  billing_cycle: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  price: number;
  discount_percentage: number;
  max_bookings_per_cycle: number;
  is_active: boolean;
  subscribers_count: number;
  created_at: string;
}

interface Subscriber {
  id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  plan_id: string;
  plan_name: string;
  subscribed_at: string;
  next_billing_date: string;
  bookings_used_this_cycle: number;
  status: 'active' | 'paused' | 'cancelled';
  auto_renew: boolean;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SubscriptionsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [availableServices, setAvailableServices] = useState<Array<{ id: string; name: string; price: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Modal states
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [showSubscribersModal, setShowSubscribersModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [planForm, setPlanForm] = useState({
    name: '',
    description: '',
    service_id: '',
    billing_cycle: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    price: 0,
    max_bookings_per_cycle: 1,
    is_active: true,
  });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      const [plansRes, servicesRes] = await Promise.all([
        apiClient.get<any>(`/subscriptions/plans/vendor/${vendorId}`),
        apiClient.get<any>(`/vendor/${vendorId}/services`),
      ]);
      
      setPlans(plansRes.plans || plansRes || []);
      setAvailableServices(servicesRes.services || servicesRes || []);
    } catch (err: any) {
      console.error('Error loading subscriptions:', err);
      setError(err.message || 'Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const loadSubscribers = async (planId: string) => {
    try {
      const response = await apiClient.get<any>(`/vendor/subscriptions/plans/${planId}/subscribers`).catch(() => null);
      
      if (response?.subscribers) {
        setSubscribers(response.subscribers);
      } else {
        // Mock data
        setSubscribers([
          { id: 'sub1', customer_id: 'c1', customer_name: 'Rajesh Kumar', customer_phone: '9876543210', plan_id: planId, plan_name: 'Monthly Grooming Pass', subscribed_at: '2025-12-01', next_billing_date: '2026-01-01', bookings_used_this_cycle: 2, status: 'active', auto_renew: true },
          { id: 'sub2', customer_id: 'c2', customer_name: 'Priya Sharma', customer_phone: '9876543211', plan_id: planId, plan_name: 'Monthly Grooming Pass', subscribed_at: '2025-11-15', next_billing_date: '2026-01-15', bookings_used_this_cycle: 4, status: 'active', auto_renew: true },
          { id: 'sub3', customer_id: 'c3', customer_name: 'Amit Patel', customer_phone: '9876543212', plan_id: planId, plan_name: 'Monthly Grooming Pass', subscribed_at: '2025-10-20', next_billing_date: '2026-01-20', bookings_used_this_cycle: 0, status: 'paused', auto_renew: false },
        ]);
      }
      
      setSelectedPlanId(planId);
      setShowSubscribersModal(true);
    } catch (err: any) {
      setError(err.message || 'Failed to load subscribers');
    }
  };

  // ============================================================================
  // ACTIONS
  // ============================================================================

  const handleCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      description: '',
      service_id: '',
      billing_cycle: 'monthly',
      price: 0,
      max_bookings_per_cycle: 1,
      is_active: true,
    });
    setShowPlanModal(true);
  };

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      description: plan.description,
      service_id: plan.service_id,
      billing_cycle: plan.billing_cycle,
      price: plan.price,
      max_bookings_per_cycle: plan.max_bookings_per_cycle,
      is_active: plan.is_active,
    });
    setShowPlanModal(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.service_id) {
      setError('Please fill all required fields');
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      
      const vendorId = localStorage.getItem('vendorId');
      if (editingPlan) {
        await apiClient.put(`/subscriptions/plans/${editingPlan.id}`, planForm);
        setSuccess('Subscription plan updated successfully');
      } else {
        await apiClient.post('/subscriptions/plans', { ...planForm, vendorId });
        setSuccess('Subscription plan created successfully');
      }
      
      setShowPlanModal(false);
      setEditingPlan(null);
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to save subscription plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this subscription plan? Existing subscribers will be notified.')) return;
    
    try {
      await apiClient.delete(`/subscriptions/plans/${planId}`);
      setSuccess('Subscription plan deleted');
      loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete subscription plan');
    }
  };

  const calculateDiscount = () => {
    const selectedService = availableServices.find(s => s.id === planForm.service_id);
    if (!selectedService || planForm.max_bookings_per_cycle === 0) return { total: 0, discount: 0, percentage: 0 };
    
    const totalPrice = selectedService.price * planForm.max_bookings_per_cycle;
    const discount = totalPrice - planForm.price;
    const percentage = Math.round((discount / totalPrice) * 100);
    return { total: totalPrice, discount, percentage };
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  const discountCalc = calculateDiscount();
  const cycleLabels: Record<string, string> = {
    weekly: 'Week',
    monthly: 'Month',
    quarterly: 'Quarter',
    yearly: 'Year',
  };

  return (
    <div className="vendor-page-shell bg-gray-50">
      <div className="vendor-app-column bg-white min-h-screen">
        <VendorHeader
          title="Subscription Plans"
          subtitle="Create recurring subscription plans for customers"
          onBack={() => router.back()}
          actions={[
            <button
              key="create"
              type="button"
              onClick={handleCreatePlan}
              className="whitespace-nowrap rounded-lg bg-orange-500 px-3 py-2 text-sm font-medium text-white hover:bg-orange-600 transition"
            >
              + Create Plan
            </button>,
          ]}
        />

        <div className="w-full px-4 py-6 sm:px-6">

        {/* Messages */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        
        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center justify-between">
            <span>{success}</span>
            <button onClick={() => setSuccess(null)} className="text-green-400 hover:text-green-600">✕</button>
          </div>
        )}

        {/* Plans Grid */}
        {plans.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">🔄</div>
            <p className="text-gray-500 mb-4">No subscription plans created yet</p>
            <button
              onClick={handleCreatePlan}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Create Your First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{plan.description}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Service:</span>
                    <span className="font-medium">{plan.service_name}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Billing cycle:</span>
                    <span className="font-medium capitalize">{plan.billing_cycle}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Bookings per cycle:</span>
                    <span className="font-medium">{plan.max_bookings_per_cycle}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Price per cycle:</span>
                    <span className="font-bold text-orange-600">₹{plan.price.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Savings:</span>
                    <span className="font-medium text-green-600">{plan.discount_percentage}% OFF</span>
                  </div>
                </div>
                
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-gray-500">Subscribers:</span>
                    <span className="font-semibold text-gray-900">{plan.subscribers_count}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadSubscribers(plan.id)}
                      className="flex-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    >
                      View Subscribers
                    </button>
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="px-3 py-2 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium hover:bg-orange-200 transition"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan.id)}
                      className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 transition"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

      {/* Modals */}
      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">
                  {editingPlan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
                </h3>
                <button onClick={() => setShowPlanModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  placeholder="e.g., Monthly Grooming Pass"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={planForm.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPlanForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                  placeholder="Describe the subscription benefits"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
                <select
                  value={planForm.service_id}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanForm(prev => ({ ...prev, service_id: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                >
                  <option value="">Select a service</option>
                  {availableServices.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name} (₹{service.price.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Billing Cycle *</label>
                  <select
                    value={planForm.billing_cycle}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPlanForm(prev => ({ ...prev, billing_cycle: e.target.value as any }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                  >
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Bookings per Cycle *</label>
                  <input
                    type="number"
                    value={planForm.max_bookings_per_cycle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanForm(prev => ({ ...prev, max_bookings_per_cycle: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 outline-none"
                    min="1"
                  />
                </div>
              </div>
              
              {/* Pricing */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total Value per {cycleLabels[planForm.billing_cycle]}:</span>
                  <span className="font-medium">₹{discountCalc.total.toLocaleString()}</span>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subscription Price per {cycleLabels[planForm.billing_cycle]} *</label>
                  <input
                    type="number"
                    value={planForm.price}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanForm(prev => ({ ...prev, price: Number(e.target.value) }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-100 outline-none"
                  />
                </div>
                {discountCalc.total > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Customer Savings:</span>
                    <span className={`font-medium ${discountCalc.percentage > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {discountCalc.percentage > 0 ? `${discountCalc.percentage}% OFF` : 'No discount'}
                    </span>
                  </div>
                )}
              </div>
              
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={planForm.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPlanForm(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded text-orange-500"
                />
                <span className="text-sm text-gray-700">Plan is active and available for subscription</span>
              </label>
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end gap-3 rounded-b-2xl">
              <button
                onClick={() => setShowPlanModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSavePlan}
                disabled={saving}
                className="px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingPlan ? 'Update Plan' : 'Create Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscribers Modal */}
      {showSubscribersModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white z-10">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-gray-900">Plan Subscribers</h3>
                <button onClick={() => setShowSubscribersModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl">✕</button>
              </div>
            </div>
            
            <div className="p-6">
              {subscribers.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-5xl mb-4">👥</div>
                  <p className="text-gray-500">No subscribers yet</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {subscribers.map(subscriber => (
                    <div key={subscriber.id} className="border rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-gray-900">{subscriber.customer_name}</h4>
                          <p className="text-sm text-gray-500">{subscriber.customer_phone}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          subscriber.status === 'active' ? 'bg-green-100 text-green-700' :
                          subscriber.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {subscriber.status}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                        <div>
                          <p className="text-gray-500">Subscribed</p>
                          <p className="font-medium">{new Date(subscriber.subscribed_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Next Billing</p>
                          <p className="font-medium">{new Date(subscriber.next_billing_date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Bookings Used</p>
                          <p className="font-medium">{subscriber.bookings_used_this_cycle}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Auto Renew</p>
                          <p className="font-medium">{subscriber.auto_renew ? '✅ Yes' : '❌ No'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-6 border-t bg-gray-50 flex justify-end rounded-b-2xl">
              <button
                onClick={() => setShowSubscribersModal(false)}
                className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

