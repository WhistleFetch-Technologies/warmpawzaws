'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { ArrowLeft, Plus, Edit2, Trash2, Shield } from 'lucide-react';

interface InsurancePlan {
  id: string;
  name: string;
  description: string;
  plan_type: 'comprehensive' | 'accident_only' | 'illness_only' | 'wellness' | 'custom';
  coverage_amount: number;
  premium: number;
  deductible: number;
  pet_types: string[];
  age_min?: number;
  age_max?: number;
  is_active: boolean;
  created_at: string;
}

export default function InsurancePlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<InsurancePlan | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    plan_type: 'comprehensive' as InsurancePlan['plan_type'],
    coverage_amount: '',
    premium: '',
    deductible: '',
    pet_types: [] as string[],
    age_min: '',
    age_max: '',
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) {
        router.push('/');
        return;
      }
      const response = await apiClient.get<any>(`/vendor/${vendorId}/insurance/plans`);
      if (response.success || response.plans) {
        setPlans(response.plans || []);
      }
    } catch (error: any) {
      console.error('Error loading insurance plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;

      const payload = {
        ...formData,
        coverage_amount: parseFloat(formData.coverage_amount),
        premium: parseFloat(formData.premium),
        deductible: parseFloat(formData.deductible),
        age_min: formData.age_min ? parseInt(formData.age_min) : undefined,
        age_max: formData.age_max ? parseInt(formData.age_max) : undefined,
      };

      if (editingPlan) {
        await apiClient.put(`/vendor/${vendorId}/insurance/plans/${editingPlan.id}`, payload);
      } else {
        await apiClient.post(`/vendor/${vendorId}/insurance/plans`, payload);
      }
      setShowAddModal(false);
      setEditingPlan(null);
      resetForm();
      loadPlans();
    } catch (error: any) {
      alert(error.message || 'Failed to save insurance plan');
    }
  };

  const handleDelete = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this insurance plan?')) return;
    try {
      const vendorId = localStorage.getItem('vendorId');
      if (!vendorId) return;
      await apiClient.delete(`/vendor/${vendorId}/insurance/plans/${planId}`);
      loadPlans();
    } catch (error: any) {
      alert(error.message || 'Failed to delete insurance plan');
    }
  };

  const togglePetType = (petType: string) => {
    setFormData({
      ...formData,
      pet_types: formData.pet_types.includes(petType)
        ? formData.pet_types.filter(t => t !== petType)
        : [...formData.pet_types, petType],
    });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      plan_type: 'comprehensive',
      coverage_amount: '',
      premium: '',
      deductible: '',
      pet_types: [],
      age_min: '',
      age_max: '',
    });
  };

  const openEditModal = (plan: InsurancePlan) => {
    setEditingPlan(plan);
    setFormData({
      name: plan.name,
      description: plan.description,
      plan_type: plan.plan_type,
      coverage_amount: plan.coverage_amount.toString(),
      premium: plan.premium.toString(),
      deductible: plan.deductible.toString(),
      pet_types: plan.pet_types,
      age_min: plan.age_min?.toString() || '',
      age_max: plan.age_max?.toString() || '',
    });
    setShowAddModal(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const petTypes = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'];
  const planTypes = [
    { value: 'comprehensive', label: 'Comprehensive' },
    { value: 'accident_only', label: 'Accident Only' },
    { value: 'illness_only', label: 'Illness Only' },
    { value: 'wellness', label: 'Wellness' },
    { value: 'custom', label: 'Custom' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">📋 Insurance Plans</h1>
                <p className="text-sm text-gray-500">Create and manage pet insurance plans</p>
              </div>
            </div>
            <button
              onClick={() => {
                resetForm();
                setEditingPlan(null);
                setShowAddModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition"
            >
              <Plus className="w-5 h-5" />
              Create Plan
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {plans.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center shadow-sm">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No insurance plans yet</h3>
            <p className="text-gray-500 mb-4">Create your first insurance plan to start offering coverage</p>
            <button
              onClick={() => {
                resetForm();
                setShowAddModal(true);
              }}
              className="px-6 py-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition"
            >
              Create First Plan
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`bg-white rounded-xl p-6 shadow-sm border-2 transition ${
                  plan.is_active ? 'border-green-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                    <p className="text-sm text-gray-500 mt-1 capitalize">{plan.plan_type.replace('_', ' ')}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      plan.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Coverage:</span>
                    <span className="font-medium text-gray-900">₹{plan.coverage_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Premium:</span>
                    <span className="font-bold text-orange-600">₹{plan.premium}/month</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Deductible:</span>
                    <span className="font-medium text-gray-900">₹{plan.deductible}</span>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-2">Pet Types:</p>
                  <div className="flex flex-wrap gap-1">
                    {plan.pet_types.map((type) => (
                      <span
                        key={type}
                        className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(plan)}
                    className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
                  >
                    <Edit2 className="w-4 h-4 inline mr-1" />
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(plan.id)}
                    className="px-3 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingPlan ? 'Edit Insurance Plan' : 'Create New Insurance Plan'}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Comprehensive Pet Insurance"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe the insurance plan..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plan Type
                </label>
                <select
                  value={formData.plan_type}
                  onChange={(e) => setFormData({ ...formData, plan_type: e.target.value as InsurancePlan['plan_type'] })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {planTypes.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Coverage (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.coverage_amount}
                    onChange={(e) => setFormData({ ...formData, coverage_amount: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Premium (₹/month)
                  </label>
                  <input
                    type="number"
                    value={formData.premium}
                    onChange={(e) => setFormData({ ...formData, premium: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Deductible (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.deductible}
                    onChange={(e) => setFormData({ ...formData, deductible: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Pet Types
                </label>
                <div className="flex flex-wrap gap-2">
                  {petTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => togglePetType(type)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition ${
                        formData.pet_types.includes(type)
                          ? 'bg-orange-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Age (months)
                  </label>
                  <input
                    type="number"
                    value={formData.age_min}
                    onChange={(e) => setFormData({ ...formData, age_min: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Optional"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Age (months)
                  </label>
                  <input
                    type="number"
                    value={formData.age_max}
                    onChange={(e) => setFormData({ ...formData, age_max: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    placeholder="Optional"
                    min="0"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingPlan(null);
                  resetForm();
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium"
              >
                {editingPlan ? 'Update' : 'Create'} Plan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

